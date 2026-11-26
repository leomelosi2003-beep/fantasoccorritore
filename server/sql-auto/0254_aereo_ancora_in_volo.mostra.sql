\pset pager off
select 'A', a.id, a.status, m.status mstat, left(m.title, 40), m.category, m.event_ends_at, a.assigned_at, a.completes_at, public.fs_route_end(a.route, a.completes_at) route_end, o.name
  from mission_assignments a join missions m on m.id = a.mission_id join organizations o on o.id = a.org_id
 where a.route::text like '%✈%' and (public.fs_route_end(a.route, a.completes_at) > now() - interval '10 minutes' or a.status not in ('conclusa','annullata'))
 order by a.assigned_at desc limit 15;
select 'R2', a.id, x.e->>'l', to_timestamp((x.e->>'t')::numeric)
  from mission_assignments a, jsonb_array_elements(a.route) x(e)
 where a.route::text like '%✈%' and public.fs_route_end(a.route, a.completes_at) > now() - interval '10 minutes'
   and x.e ? 'l' limit 30;
select 'V', pg_get_viewdef('public.live_ambulances'::regclass);
