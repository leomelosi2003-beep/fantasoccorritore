-- 191: my_objectives faceva 6 letture separate dei servizi (2,5 s per chiamata, e la mappa la chiama
-- ogni 2 minuti per ogni giocatore). Ora un solo passaggio calcola tutte le metriche di oggi, della settimana
-- e l'incasso degli ultimi 7 giorni. Stessi numeri di prima.

create or replace function public.objective_metrics(p_org uuid, d_from timestamptz, d_to timestamptz, w_from timestamptz, w_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with x as (
    select a.completed_at t, a.reward_funds rf, a.auto, a.arrives_at - a.assigned_at dt,
           m.code, m.category, m.transport, m.event_id, m.venue
      from mission_assignments a join missions m on m.id = a.mission_id
     where a.org_id = p_org and a.status = 'conclusa'
       and a.completed_at >= least(w_from, d_from, now() - interval '7 days') and a.completed_at < greatest(w_to, d_to, now())
  ), k as (
    select p, f, t from (values ('d', d_from, d_to), ('w', w_from, w_to)) v(p, f, t)
  )
  select jsonb_object_agg(k.p || '_' || mm.key, mm.val) || jsonb_build_object('inc7',
           (select coalesce(sum(rf), 0) from x where x.t >= now() - interval '7 days'))
    from k cross join lateral (
      select * from jsonb_each((
        select jsonb_build_object(
          'servizi',  count(*),
          'rossi',    count(*) filter (where code = 'rosso'),
          'gialli',   count(*) filter (where code = 'giallo'),
          'manuali',  count(*) filter (where not auto),
          'incasso',  coalesce(sum(rf), 0),
          'trasf',    count(*) filter (where transport = 'trasferimento'),
          'ordinari', count(*) filter (where category = 'ordinario' and transport is distinct from 'trasferimento'),
          'mare',     count(*) filter (where category = 'mare'),
          'incendi',  count(*) filter (where category = 'grande_evento' and event_id is null and venue = 'AIB'),
          'veloci',   count(*) filter (where code = 'rosso' and dt <= interval '30 seconds'))
        from x where x.t >= k.f and x.t < k.t))) mm(key, val)
$$;
revoke all on function public.objective_metrics(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.my_objectives'::regproc), E'\r\n', E'\n');
  if position('objective_metrics(' in src) > 0 then return; end if;
  s := replace(src, '  v_out jsonb := ''[]''::jsonb;', '  v_out jsonb := ''[]''::jsonb; v_all jsonb;');
  s := replace(s, '  v_avg := objective_metric(v_org, ''incasso'', now() - interval ''7 days'', now()) / 7;',
                  '  v_all := objective_metrics(v_org, d_from, d_to, w_from, w_to);' || E'\n' ||
                  '  v_avg := coalesce((v_all->>''inc7'')::bigint, 0) / 7;');
  s := replace(s, 'v_prog := objective_metric(v_org, r.metric, d_from, d_to);', 'v_prog := coalesce((v_all->>(''d_'' || r.metric))::bigint, 0);');
  s := replace(s, 'v_prog := objective_metric(v_org, r.metric, w_from, w_to);', 'v_prog := coalesce((v_all->>(''w_'' || r.metric))::bigint, 0);');
  if position('objective_metric(v_org' in s) > 0 or position('v_all := objective_metrics' in s) = 0 then
    raise exception 'my_objectives: patch non applicata';
  end if;
  execute s;
end $$;
