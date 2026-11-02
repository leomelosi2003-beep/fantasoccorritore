-- bases_map: alleanza, sede principale, numero sedi e ambulanze dell'associazione, posti, reputazione
create or replace view bases_map with (security_invoker = true) as
select b.id, b.org_id, b.name, b.level, b.is_headquarters,
       o.name as org_name, o.type as org_type, o.theme,
       st_y(b.location::geometry) as lat, st_x(b.location::geometry) as lng, o.logo_url,
       (select a.name from alliance_members m join alliances a on a.id = m.alliance_id where m.org_id = o.id) as alliance,
       (select h.name from bases h where h.org_id = o.id and h.is_headquarters limit 1) as hq_name,
       (select count(*) from bases x where x.org_id = o.id)::int as org_bases,
       (select count(*) from vehicles v where v.base_id = b.id)::int as vehicles_here,
       (select count(*) from vehicles v where v.org_id = o.id)::int as org_vehicles,
       b.vehicle_capacity, o.reputation
from bases b join organizations o on o.id = b.org_id;
