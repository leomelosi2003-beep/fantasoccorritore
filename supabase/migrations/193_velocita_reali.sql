-- 193: velocità reali dei mezzi.
-- Ogni modello ha una velocità massima (vmax_kmh) e un'agilità in città/curve (agility, 1 = normale).
-- Il tragitto è fatto di un pezzo in città (i primi/ultimi ~3 km di strada) e di un pezzo extraurbano:
--   in città conta l'agilità (il T5 e il motorino sono più svelti), fuori conta la velocità massima (lo Sprinter è più veloce).
-- Niente più compressione del servizio a 4-10 minuti: i tempi sono quelli del viaggio vero. Premi per servizio invariati.

alter table vehicle_models add column if not exists vmax_kmh smallint;
alter table vehicle_models add column if not exists agility numeric(3,2);

update vehicle_models v set vmax_kmh = x.vmax, agility = x.agi
  from (values
    ('M-Sprinterix', 165, 0.90), ('M-Sprinterix E', 155, 0.92), ('M-Sprinterix XL', 155, 0.85), ('M-Sprinterix XL E', 150, 0.87),
    ('V-Transporto', 150, 1.10), ('V-Transporto E', 145, 1.12), ('V-Craftor', 155, 1.00), ('V-Craftor E', 150, 1.02),
    ('F-Transitor', 155, 0.95), ('F-Transitor E', 150, 0.97), ('F-Ducalis', 150, 0.92), ('F-Ducalis E', 145, 0.94),
    ('R-Masteron', 145, 0.90), ('R-Masteron E', 140, 0.92), ('C-Civix', 160, 1.05), ('C-Civix E', 150, 1.08),
    ('D-Daily AIB', 120, 0.80), ('P-Ranger AIB', 165, 1.00), ('S-Scorpio AIB', 155, 0.95),
    ('D-Dustar', 165, 1.05), ('D-Dustar E', 155, 1.08), ('F-Kugar', 195, 1.12), ('F-Kugar E', 185, 1.14),
    ('S-Kamik', 190, 1.05), ('S-Kamik E', 175, 1.08), ('T-Voltara', 210, 1.10),
    ('Y-Scootix', 125, 1.45), ('Y-Scootix E', 105, 1.50)
  ) as x(name, vmax, agi)
 where v.name = x.name;

-- le vecchie abilità "curve"/"rettilineo" ora sono dentro velocità massima e agilità
update vehicle_models set ability_label = '🌀 Agile: più svelto in città e nelle curve'
 where ability = 'curve' and not boat;
update vehicle_models set ability_label = '🛣️ Veloce in rettilineo: velocità massima alta'
 where ability = 'rettilineo' and not boat;

-- secondi di guida da a a b. p_mode: 'rosso' / 'giallo' (sirene) oppure altro (guida normale, rientri)
create or replace function public.drive_seconds(a geography, b geography, p_vmax numeric, p_agi numeric, p_mode text, p_boost numeric default 1)
returns numeric language sql immutable set search_path to 'public', 'extensions' as $$
  with k as (select greatest(0.2, st_distance(a, b) / 1000.0 * 1.3) road,
                    coalesce(p_vmax, 150) vmax, coalesce(p_agi, 1) agi, greatest(coalesce(p_boost, 1), 0.5) boost),
       v as (select road, least(road, 3.0) city, greatest(0, road - 3.0) open,
                    case p_mode when 'rosso' then 50 * agi when 'giallo' then 44 * agi else 35 * agi end * boost cv,
                    case p_mode when 'rosso' then least(vmax * 0.80, 130) when 'giallo' then least(vmax * 0.75, 115)
                                else least(vmax * 0.65, 90) end * boost ov
               from k)
  select greatest(20, (city / cv + open / ov) * 3600) from v
$$;

-- claim_mission_as: velocità vere, niente compressione
do $$
declare src text; n int;
begin
  select replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n') into src;
  if src like '%drive_seconds%' then raise notice 'claim già aggiornata'; return; end if;
  src := replace(src, 'v_moor geography;', 'v_moor geography; v_vmax numeric; v_agi numeric; v_boost numeric;');
  src := replace(src, '  v_back := 40 * sf;',
    '  v_back := 40 * sf;
  select coalesce(vm.vmax_kmh, 150), coalesce(vm.agility, 1) into v_vmax, v_agi from vehicle_models vm where vm.id = veh.model_id;
  v_boost := 1 + 0.12 * coalesce(veh.speed_level, 0);');
  src := regexp_replace(src, 'leg_minutes\(([a-z_.]+), ([a-z_.]+), v_back\) \* 60', 'drive_seconds(\1, \2, v_vmax, v_agi, ''rientro'', v_boost)', 'g');
  src := regexp_replace(src, 'leg_minutes\(([a-z_.]+), ([a-z_.]+), v_em\) \* 60', 'drive_seconds(\1, \2, v_vmax, v_agi, m.code::text, v_boost)', 'g');
  src := replace(src, 'leg_road_minutes(h.location, d.location, (case when m.code in (''giallo'', ''rosso'') then 115 else 100 end) * sf) * 60',
                      'drive_seconds(h.location, d.location, v_vmax, v_agi, m.code::text, v_boost)');
  src := replace(src, 'leg_road_minutes(d.location, b.location, (case when m.code in (''giallo'', ''rosso'') then 115 else 100 end) * sf) * 60',
                      'drive_seconds(d.location, b.location, v_vmax, v_agi, ''rientro'', v_boost)');
  -- niente più tetto di 1 ora e niente compressione a 4-10 minuti
  src := replace(src, 'if m.transport is distinct from ''trasferimento'' and m.event_ends_at is null and t5 - t0 > interval ''62 minutes'' then',
                      'if false then -- (193) tetto di 1 ora tolto: tempi reali');
  src := replace(src, 'if m.transport is distinct from ''trasferimento'' and m.event_ends_at is null and v_free - t0 > interval ''2 minutes'' then',
                      'if false then -- (193) compressione a 4-10 minuti tolta: tempi reali');
  -- AIB: velocità media vera (in linea d'aria) invece di 250 km/h
  src := replace(src, '250 * sf)', '55 * v_agi * v_boost)');
  if src like '%leg_minutes%' or src like '%leg_road_minutes%' or src like '%250 * sf%' or (length(src) - length(replace(src, 'if false then', ''))) / 13 <> 2 then
    raise exception 'patch claim incompleta';
  end if;
  execute src;
end $$;

-- cambio ospedale, opzioni ospedale, annullo viaggio, stima di viaggio
do $$
declare src text;
begin
  select replace(pg_get_functiondef('public.change_hospital'::regproc), E'\r\n', E'\n') into src;
  if src not like '%drive_seconds%' then
    src := replace(src, 'leg_minutes(start_pt, h.location, v_em) * 60',
      'drive_seconds(start_pt, h.location, (select vm.vmax_kmh from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), (select vm.agility from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), m.code::text, (select 1 + 0.12 * coalesce(v.speed_level, 0) from vehicles v where v.id = a.vehicle_id))');
    src := replace(src, 'leg_minutes(h.location, b.location, v_back) * 60',
      'drive_seconds(h.location, b.location, (select vm.vmax_kmh from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), (select vm.agility from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), ''rientro'', (select 1 + 0.12 * coalesce(v.speed_level, 0) from vehicles v where v.id = a.vehicle_id))');
    if src like '%leg_minutes%' then raise exception 'patch change_hospital incompleta'; end if;
    execute src;
  end if;

  select replace(pg_get_functiondef('public.cancel_assignment'::regproc), E'\r\n', E'\n') into src;
  if src not like '%drive_seconds%' then
    src := replace(src, 'leg_minutes(pos, b.location, 40 * coalesce(sf, 1)) * 60',
      'drive_seconds(pos, b.location, (select vm.vmax_kmh from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), (select vm.agility from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), ''rientro'')');
    if src like '%leg_minutes%' then raise exception 'patch cancel incompleta'; end if;
    execute src;
  end if;

  select replace(pg_get_functiondef('public.hospital_options'::regproc), E'\r\n', E'\n') into src;
  if src not like '%drive_seconds%' then
    src := replace(src, 'round(leg_minutes(start_pt, h.location, v_em))::int',
      'round(drive_seconds(start_pt, h.location, (select vm.vmax_kmh from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), (select vm.agility from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id), m.code::text) / 60)::int');
    src := replace(src, 'order by leg_minutes(start_pt, h.location, v_em)', 'order by st_distance(start_pt, h.location)');
    if src like '%leg_minutes%' then raise exception 'patch hospital_options incompleta'; end if;
    execute src;
  end if;
end $$;

create or replace function public.travel_estimate(p_mission_id uuid, p_vehicle_id uuid)
returns jsonb language sql stable security definer set search_path to 'public', 'extensions' as $$
  select jsonb_build_object(
    'km', round((st_distance(vehicle_position(v.id, b.location), m.location) / 1000.0)::numeric, 1),
    'minutes', round(drive_seconds(vehicle_position(v.id, b.location), m.location, vm.vmax_kmh, vm.agility, m.code::text,
                                   1 + 0.12 * coalesce(v.speed_level, 0)) / 60.0, 1))
  from missions m, vehicles v join bases b on b.id = v.base_id join vehicle_models vm on vm.id = v.model_id
  where m.id = p_mission_id and v.id = p_vehicle_id and can_use_vehicle(v.id, my_org_id())
$$;

-- premio: prima calava di 1/30 per ogni minuto di viaggio (con viaggi da 40 s non contava); ora 1/90, così il premio resta quello di prima
do $$
declare src text;
begin
  select replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n') into src;
  if src like '%travel_min / 90.0%' then return; end if;
  src := replace(src, '1.5 - travel_min / 30.0', '1.5 - travel_min / 90.0');
  if src not like '%travel_min / 90.0%' then raise exception 'patch premio non applicata'; end if;
  execute src;
end $$;

-- obiettivo "veloci": codici rossi raggiunti in meno di 5 minuti (prima 30 secondi)
do $$
declare f text; src text;
begin
  foreach f in array array['public.objective_metrics', 'public.objective_metric', 'public.my_objectives'] loop
    select replace(pg_get_functiondef(f::regproc), E'\r\n', E'\n') into src;
    src := replace(src, 'interval ''30 seconds''', 'interval ''5 minutes''');
    src := replace(src, 'in meno di 30 secondi', 'in meno di 5 minuti');
    execute src;
  end loop;
end $$;
