select 'M', m.venue, m.category, m.event_id is null, m.event_ends_at::time(0), a.assigned_at::time(0), a.arrives_at::time(0), a.completes_at::time(0), jsonb_array_length(a.route)
from mission_assignments a join missions m on m.id = a.mission_id join vehicles v on v.id = a.vehicle_id
where v.call_sign = 'AIB 1' and v.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' order by a.assigned_at desc limit 1;
select 'P', i, p->>'label', (p->>'t')::timestamptz::time(0) from mission_assignments a join vehicles v on v.id = a.vehicle_id,
  jsonb_array_elements(a.route) with ordinality q(p, i)
where a.id = (select a2.id from mission_assignments a2 join vehicles v2 on v2.id = a2.vehicle_id where v2.call_sign = 'AIB 1' and v2.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' order by a2.assigned_at desc limit 1)
order by i desc limit 6;
