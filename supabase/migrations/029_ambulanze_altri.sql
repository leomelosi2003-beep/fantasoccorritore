-- Le ambulanze degli altri giocatori in servizio, visibili sulla mappa a tutti
create or replace view live_ambulances with (security_invoker = true) as
select a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.route,
       m.title, m.code, v.call_sign, vm.image_url as vehicle_image,
       o.id as org_id, o.name as org_name, o.type as org_type, o.logo_url,
       h.name as hospital,
       st_y(b.location::geometry) as base_lat, st_x(b.location::geometry) as base_lng,
       st_y(m.location::geometry) as lat, st_x(m.location::geometry) as lng
from mission_assignments a
join missions m on m.id = a.mission_id
join vehicles v on v.id = a.vehicle_id
join organizations o on o.id = a.org_id
join bases b on b.id = a.base_id
left join vehicle_models vm on vm.id = v.model_id
left join hospitals h on h.id = a.hospital_id
where a.status <> 'conclusa' and a.completes_at > now() - interval '1 minute'
  and a.org_id is distinct from my_org_id();
grant select on live_ambulances to authenticated;
