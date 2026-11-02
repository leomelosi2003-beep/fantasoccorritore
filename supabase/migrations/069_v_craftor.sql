-- Nuovo modello: V-Craftor (furgone tipo grande van tedesco, nome di fantasia)
insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, image_url, is_active, description)
select 'V-Craftor', 43000, 1.05, 78, 78, null, true, 'Solido e spazioso: veloce quasi quanto i migliori e dura a lungo.'
where not exists (select 1 from vehicle_models where name = 'V-Craftor');
update vehicle_models set image_url = '/vehicles/v-craftor.png' where name = 'V-Craftor';
