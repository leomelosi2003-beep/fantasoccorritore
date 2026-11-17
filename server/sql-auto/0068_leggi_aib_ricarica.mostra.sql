set search_path = public, extensions;
-- per ogni mezzo AIB in servizio: dove ricarica, quanto è lontano dal fuoco, se è la sua sede, e quanto dista la sede più vicina in assoluto
select 'RIC', a.id::text, (select count(*) from jsonb_array_elements(a.route) p where p->>'label' = 'Ricarica acqua') n_ricariche,
  round((st_distance(m.location, st_setsrid(st_makepoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography) / 1000)::numeric, 1) km_ricarica,
  round((select min(st_distance(b.location, m.location)) from bases b)::numeric / 1000, 1) km_sede_piu_vicina,
  exists (select 1 from bases b where b.org_id = a.org_id and st_dwithin(b.location, st_setsrid(st_makepoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography, 30)) ricarica_in_sede_propria,
  a.assigned_at::date
from mission_assignments a join missions m on m.id = a.mission_id
left join lateral (select p r from jsonb_array_elements(a.route) p where p->>'label' = 'Ricarica acqua' limit 1) x on true
where m.venue = 'AIB' and a.status not in ('conclusa','annullata');
