\pset pager off
select 'A', a.status, m.status mstat, m.title, m.event_ends_at, a.completes_at, o.name, count(*)
  from mission_assignments a join missions m on m.id = a.mission_id join organizations o on o.id = a.org_id
 where a.route::text like '%✈%' and (a.completes_at > now() - interval '2 hours' or a.status not in ('conclusa','annullata'))
 group by 1,2,3,4,5,6,7 order by a.completes_at desc limit 20;
select 'R', a.id, jsonb_path_query_array(a.route, '$[*].l') from mission_assignments a where a.route::text like '%✈%' and a.status not in ('conclusa','annullata') limit 3;
select 'R2', x.e->>'l', to_timestamp((x.e->>'t')::numeric) from mission_assignments a, jsonb_array_elements(a.route) x(e) where a.route::text like '%✈%' and a.status not in ('conclusa','annullata') limit 30;
