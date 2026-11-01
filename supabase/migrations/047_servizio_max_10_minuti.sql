-- Dalla partenza a quando l'ambulanza è di nuovo libera: massimo 10 minuti (8-10). Trasferimenti ed eventi esclusi.
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('massimo 10 minuti' in src) = 0 then
    src := replace(src, '  v_free := coalesce((v_route->-2->>''t'')::timestamptz, t5);',
'  v_free := coalesce((v_route->-2->>''t'')::timestamptz, t5);
  -- massimo 10 minuti dalla partenza a quando l''ambulanza è di nuovo libera (non per trasferimenti ed eventi)
  if m.transport is distinct from ''trasferimento'' and m.event_ends_at is null and v_free - t0 > interval ''10 minutes'' then
    sf := extract(epoch from interval ''1 minute'' * (8 + random() * 2)) / extract(epoch from v_free - t0);
    v_route := scale_route(v_route, t0, sf);
    t1 := t0 + (t1 - t0) * sf;
    t5 := t0 + (t5 - t0) * sf;
    v_free := t0 + (v_free - t0) * sf;
  end if;');
    execute src;
  end if;
end $do$;
