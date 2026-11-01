-- Servizi più corti: al massimo circa 1 ora dall'uscita al rientro (trasferimenti esclusi).
-- Trasferimenti più frequenti.
create or replace function scale_route(r jsonb, t0 timestamptz, f numeric) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(p || jsonb_build_object('t', t0 + ((p->>'t')::timestamptz - t0) * f) order by i), '[]')
  from jsonb_array_elements(r) with ordinality x(p, i) $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('scale_route' in src) = 0 then
    src := replace(src, '  v_route := hospital_gates(v_route);',
'  v_route := hospital_gates(v_route);
  -- servizio intero al massimo ~1 ora (non per trasferimenti ed eventi)
  if m.transport is distinct from ''trasferimento'' and m.event_ends_at is null and t5 - t0 > interval ''62 minutes'' then
    sf := extract(epoch from interval ''1 minute'' * (55 + floor(random() * 8))) / extract(epoch from t5 - t0);
    v_route := scale_route(v_route, t0, sf);
    t1 := t0 + (t1 - t0) * sf;
    t5 := t0 + (t5 - t0) * sf;
  end if;');
    execute src;
  end if;

  src := pg_get_functiondef('generate_transfers()'::regprocedure);
  src := replace(src, 'expires_at > now()) >= 2 then', 'expires_at > now()) >= 3 then');
  src := replace(src, 'if random() > 0.5 then return 0; end if;', 'if random() > 0.75 then return 0; end if;');
  execute src;
end $do$;
select cron.unschedule(jobname) from cron.job where jobname = 'generate-transfers';
select cron.schedule('generate-transfers', '*/5 * * * *', $$select generate_transfers()$$);

select position('scale_route' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as servizi_ok,
       position('>= 3' in pg_get_functiondef('generate_transfers()'::regprocedure)) > 0 as trasferimenti_ok;
