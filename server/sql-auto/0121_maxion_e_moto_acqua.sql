-- Due mezzi nuovi:
--  X-Maxion: ambulanza a doppio uso, fa sia emergenze sia trasferimenti (anche urgenti col medico).
--  B-Jetto: moto d'acqua di soccorso con barella galleggiante, la più veloce in mare, equipaggio di 2 (1 bagnino + 1 soccorritore).
alter table vehicle_models add column if not exists dual_use boolean not null default false;

insert into vehicle_models (name, ability, agility, electric, range_km, vmax_kmh, base_cost, image_url, is_active, ordinaria, automedica,
  maxi_slots, description, tank_liters, speed_factor, ability_label, transfer_only, base_durability, base_reliability, consumption_l100,
  aib, pma, boat, maxi, moto, dual_use)
select 'X-Maxion', 'curve', 1.02, false, null, 150, 46000, '/vehicles/x-maxion.png', true, false, false,
  0, 'Ambulanza a doppio uso: fa sia le emergenze 118 sia i trasferimenti (anche quelli urgenti col medico), senza cambiare uso. Agile in città.',
  80, 1.05, '🔁 Doppio uso: emergenze e trasferimenti', false, 76, 80, 11.5,
  false, false, false, false, false, true
where not exists (select 1 from vehicle_models where name = 'X-Maxion');

insert into vehicle_models (name, ability, agility, electric, range_km, vmax_kmh, base_cost, image_url, is_active, ordinaria, automedica,
  maxi_slots, description, tank_liters, speed_factor, ability_label, transfer_only, base_durability, base_reliability, consumption_l100,
  aib, pma, boat, maxi, moto, dual_use)
select 'B-Jetto', 'rettilineo', null, false, null, null, 28000, '/vehicles/b-jetto.png', true, false, false,
  0, 'Moto d''acqua di soccorso con barella galleggiante: la più veloce in mare e costa poco, ma ci stanno solo 2 persone (1 bagnino + 1 soccorritore).',
  60, 1.90, '🌊 Mare lampo: velocissima, equipaggio di 2', false, 64, 82, 18,
  false, false, true, false, false, false
where not exists (select 1 from vehicle_models where name = 'B-Jetto');

-- claim: il doppio uso può fare i trasferimenti; la moto d'acqua porta al massimo 2 persone
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position('JETSKI_CREW' in src) > 0 then return; end if;
  n := replace(src, $$and not coalesce((select transfer_only from vehicle_models where id = veh.model_id), false) then raise exception 'TRANSFER_NEEDS_LONG'$$,
                    $$and not coalesce((select transfer_only or dual_use from vehicle_models where id = veh.model_id), false) then raise exception 'TRANSFER_NEEDS_LONG'$$);
  if n = src then raise exception 'claim: TRANSFER_NEEDS_LONG non trovato'; end if;
  src := n;
  n := replace(src, $$      raise exception 'BOAT_CREW'; end if;
    v_moor :=$$, $$      raise exception 'BOAT_CREW'; end if;
    if (select name from vehicle_models where id = veh.model_id) = 'B-Jetto' and coalesce(array_length(p_card_ids, 1), 0) > 2 then raise exception 'JETSKI_CREW'; end if;
    v_moor :=$$);
  if n = src then raise exception 'claim: BOAT_CREW non trovato'; end if;
  execute n;
end $d$;

-- my_fleet: colonna dual_use per il sito
do $d$
declare src text; n text;
begin
  src := pg_get_viewdef('public.my_fleet'::regclass, true);
  if position('dual_use' in src) > 0 then return; end if;
  n := regexp_replace(src, E'\n   FROM vehicles v', E',\n    COALESCE(( SELECT vm.dual_use FROM vehicle_models vm WHERE vm.id = v.model_id), false) AS dual_use\n   FROM vehicles v');
  if n = src then raise exception 'my_fleet: patch non applicata'; end if;
  execute 'create or replace view public.my_fleet as ' || n;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO modelli', name, base_cost, dual_use, boat from vehicle_models where name in ('X-Maxion', 'B-Jetto');
