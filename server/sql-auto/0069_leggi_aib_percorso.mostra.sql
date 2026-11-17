select 'P', i, p->>'label', p->>'t' from mission_assignments a, jsonb_array_elements(a.route) with ordinality q(p, i)
where a.id = 'f53b049e-4db9-404d-a548-f2521050e6be' order by i limit 40;
select 'M', m.status, m.event_ends_at, a.assigned_at, a.arrives_at, a.completes_at, jsonb_array_length(a.route)
from mission_assignments a join missions m on m.id = a.mission_id where a.id = 'f53b049e-4db9-404d-a548-f2521050e6be';
