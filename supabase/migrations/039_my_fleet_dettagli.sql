-- my_fleet: aggiunge officina, immagine del modello e nome della sede
create or replace view my_fleet with (security_invoker = true) as
select v.id, v.call_sign, v.status, v.wear, v.certification, v.equipment, v.base_id, v.org_id,
       v.org_id = my_org_id() as mine,
       (select name from organizations where id = vehicle_borrower(v.id) and v.org_id = my_org_id()) as lent_to,
       case when v.org_id <> my_org_id() then (select name from organizations where id = v.org_id) end as lent_from,
       v.maintenance_until, (select image_url from vehicle_models where id = v.model_id) as vehicle_image,
       (select name from bases where id = v.base_id) as base_name
from vehicles v
where v.org_id = my_org_id() or vehicle_borrower(v.id) = my_org_id();
