-- Nuovo modello M-Sprinterix XL (passo lungo): solo trasferimenti, trasferimenti +25%.
alter table vehicle_models add column if not exists transfer_only boolean not null default false;
insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, image_url, is_active, description, transfer_only)
select 'M-Sprinterix XL', 52000, speed_factor, base_reliability, base_durability, '/vehicles/m-sprinterix-xl.png', true,
       'Passo lungo, vano sanitario enorme: fa SOLO trasferimenti, ma li paga il 25% in più.', true
from vehicle_models where name = 'M-Sprinterix' and not exists (select 1 from vehicle_models where name = 'M-Sprinterix XL');
-- claim_mission: TRANSFER_ONLY; complete_due_assignments: +25% sui trasferimenti; my_fleet.transfer_only; missions_map.transport (vedi SQL applicato)
