-- 218: mezzi per le maxi emergenze (camion logistico + furgone comando) e moduli da caricare (PMA, logistica, cinofila, droni)
alter table vehicle_models add column if not exists maxi boolean not null default false;
alter table vehicle_models add column if not exists maxi_slots smallint not null default 0;

insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
                            tank_liters, consumption_l100, electric, vmax_kmh, agility, maxi, maxi_slots, is_active)
select * from (values
  ('S-Scanix Maxi', 160000, 0.85::numeric, 80::smallint, 90::smallint, '/vehicles/maxi-camion.png',
   'Camion per le maxi emergenze: porta fino a 3 moduli (PMA, logistica, cinofila, droni). Va solo sulle maxi emergenze.', 200::smallint, 28.0::numeric, false, 110::smallint, 0.75::numeric, true, 3::smallint, true),
  ('D-Daily Comando Maxi', 110000, 0.95, 78, 84, '/vehicles/maxi-furgone.png',
   'Furgone posto di comando con torre faro e radio: porta fino a 2 moduli. Va solo sulle maxi emergenze.', 90, 14.0, false, 140, 0.90, true, 2, true)
) v(name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
    tank_liters, consumption_l100, electric, vmax_kmh, agility, maxi, maxi_slots, is_active)
where not exists (select 1 from vehicle_models m where m.name = v.name);

insert into equipment (code, slot, name, cost, provides, effects, description, image_url, sort, category) values
  ('pma_tenda', 'maxi_pma', 'PMA – tenda pneumatica', 150000, '{pma}', '{"maxi_bonus":0.6}',
   'Posto medico avanzato: alla maxi emergenza i feriti vengono portati al PMA invece che all''ospedale. +60% sulla maxi.', '/vehicles/maxi-tenda.png', 1, 'maxi'),
  ('unita_logistica', 'maxi_logistica', 'Unità logistica', 70000, '{logistica}', '{"maxi_bonus":0.25}',
   'Generatore, torre faro, tende e ristoro per i soccorritori. +25% sulla maxi.', null, 2, 'maxi'),
  ('unita_cinofila', 'maxi_cinofila', 'Unità ricerca e soccorso / cinofila', 60000, '{cinofila}', '{"maxi_bonus":0.3}',
   'Squadra con cani da ricerca sotto le macerie. +30% sulla maxi.', null, 3, 'maxi'),
  ('unita_droni', 'maxi_droni', 'Unità dronistica', 55000, '{droni}', '{"maxi_bonus":0.3}',
   'Droni con termocamera per cercare i dispersi dall''alto. +30% sulla maxi.', null, 4, 'maxi')
on conflict (code) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost, provides = excluded.provides,
  effects = excluded.effects, description = excluded.description, image_url = excluded.image_url, sort = excluded.sort, category = excluded.category;

create or replace function public.maxi_module_bonus(p_eq text[]) returns numeric
language sql stable set search_path = public, extensions as $f$
  select coalesce(sum((effects->>'maxi_bonus')::numeric), 0) from equipment where code = any(coalesce(p_eq, '{}')) and slot like 'maxi\_%'
$f$;

-- regole dei moduli: solo sui mezzi maxi, e non più dei posti del mezzo; sui mezzi maxi niente presidi normali
create or replace function public.vehicles_maxi_equipment_check() returns trigger
language plpgsql security definer set search_path = public, extensions as $f$
declare mx boolean; slots int; n_maxi int; n_other int;
begin
  select coalesce(maxi, false), maxi_slots into mx, slots from vehicle_models where id = new.model_id;
  select count(*) filter (where e.slot like 'maxi\_%'), count(*) filter (where e.slot not like 'maxi\_%')
    into n_maxi, n_other from unnest(coalesce(new.equipment, '{}')) c join equipment e on e.code = c;
  if not mx and n_maxi > 0 then raise exception 'MAXI_MODULE_ONLY'; end if;
  if mx and n_other > 0 then raise exception 'NO_EQUIPMENT_ON_THIS_VEHICLE'; end if;
  if mx and n_maxi > slots then raise exception 'MAXI_SLOTS_FULL'; end if;
  return new;
end $f$;
drop trigger if exists vehicles_maxi_equipment on vehicles;
create trigger vehicles_maxi_equipment before insert or update of equipment on vehicles
  for each row execute function public.vehicles_maxi_equipment_check();

-- patch delle funzioni esistenti
do $$
declare src text; n text;
begin
  -- acquisto: i mezzi maxi partono vuoti (i moduli si montano in Officina → Presidi)
  src := replace(pg_get_functiondef('public.buy_vehicle'::regproc), E'\r\n', E'\n');
  n := replace(src, 'if mdl.aib then p_equipment := ''{}''; end if;', 'if mdl.aib or mdl.maxi then p_equipment := ''{}''; end if;');
  n := replace(n, 'not mdl.ordinaria and not mdl.aib then raise exception ''NEED_ONE_MONITOR''', 'not mdl.ordinaria and not mdl.aib and not mdl.maxi then raise exception ''NEED_ONE_MONITOR''');
  n := replace(n, '(mdl.automedica or mdl.boat or mdl.aib)', '(mdl.automedica or mdl.boat or mdl.aib or mdl.maxi)');
  if n = src or position('mdl.maxi then raise' in n) = 0 then raise exception 'buy_vehicle: patch non applicata'; end if;
  execute n;

  -- invio: i mezzi maxi vanno solo sulle maxi emergenze, senza controllo presidi/certificazione
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'v_aib boolean := false;', 'v_aib boolean := false; v_maxi boolean := false;');
  n := replace(n, 'if veh.certification < m.min_certification then raise exception',
                  'if veh.certification < m.min_certification and not coalesce((select maxi from vehicle_models where id = veh.model_id), false) then raise exception');
  n := replace(n, '  if v_aib and m.venue is distinct from ''AIB'' then raise exception ''AIB_ONLY_FIRE''; end if;',
                  '  if v_aib and m.venue is distinct from ''AIB'' then raise exception ''AIB_ONLY_FIRE''; end if;
  v_maxi := coalesce((select maxi from vehicle_models where id = veh.model_id), false);
  if v_maxi and not (m.category = ''grande_evento'' and m.event_id is null and coalesce(m.venue, '''') <> ''AIB'') then raise exception ''MAXI_ONLY''; end if;');
  n := replace(n, 'not v_boat and not v_aib and not (m.requires', 'not v_boat and not v_aib and not v_maxi and not (m.requires');
  if position('MAXI_ONLY' in n) = 0 or position('v_maxi boolean' in n) = 0 or position('not v_maxi and not (m.requires' in n) = 0
     or position('and not coalesce((select maxi from vehicle_models where id = veh.model_id), false) then raise' in n) = 0 then
    raise exception 'claim_mission_as: patch non applicata'; end if;
  execute n;

  -- premio: bonus dei moduli sulle maxi
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  n := replace(src, '    if m.category = ''grande_evento'' and m.event_id is null then
      reward := round(reward * least(3.0,',
'    if m.category = ''grande_evento'' and m.event_id is null and coalesce(m.venue, '''') <> ''AIB'' then
      reward := round(reward * (1 + maxi_module_bonus(veh.equipment)));   -- moduli dei mezzi maxi (PMA, logistica, cinofila, droni)
    end if;
    if m.category = ''grande_evento'' and m.event_id is null then
      reward := round(reward * least(3.0,');
  if n = src then raise exception 'complete_due_assignments: patch non applicata'; end if;
  execute n;

  -- automatico: mai i mezzi maxi
  src := replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n');
  n := replace(src, 'and not vm.automedica and not vm.boat;', 'and not vm.automedica and not vm.boat and not coalesce(vm.maxi, false);');
  if n = src then raise exception 'auto_dispatch_org: patch non applicata'; end if;
  execute n;

  -- my_fleet: colonna maxi
  src := pg_get_viewdef('public.my_fleet'::regclass, true);
  n := replace(src, E'body_damage\n   FROM vehicles v', E'body_damage,\n    COALESCE(( SELECT vm.maxi FROM vehicle_models vm WHERE vm.id = v.model_id), false) AS maxi\n   FROM vehicles v');
  if n = src then raise exception 'my_fleet: patch non applicata'; end if;
  execute 'create or replace view public.my_fleet as ' || n;
end $$;

-- scena maxi: PMA anche dalla tenda montata, tipo di mezzo maxi e moduli
create or replace function public.maxi_scene(p_mission uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $f$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description, 'venue', m.venue,
    'lat', st_y(m.location::geometry), 'lng', st_x(m.location::geometry),
    'created_at', m.created_at, 'ends_at', coalesce(m.event_ends_at, m.expires_at), 'status', m.status,
    'now', now(),
    'hospital', (select jsonb_build_object('name', h.name, 'lat', st_y(h.location::geometry), 'lng', st_x(h.location::geometry))
                   from hospitals h where h.id = nearest_hospital(m.location, null)),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'call_sign', v.call_sign, 'org_name', o.name, 'mine', a.org_id = my_org_id(),
        'status', a.status, 'assigned_at', a.assigned_at, 'arrives_at', a.arrives_at, 'completes_at', a.completes_at,
        'base_lat', st_y(b.location::geometry), 'base_lng', st_x(b.location::geometry),
        'automedica', coalesce(vm.automedica, false), 'moto', coalesce(vm.moto, false),
        'pma', coalesce(vm.pma, false) or 'pma_tenda' = any(v.equipment), 'long', coalesce(vm.transfer_only, false),
        'maxi', case when coalesce(vm.maxi, false) then (case when vm.maxi_slots >= 3 then 'camion' else 'furgone' end) end,
        'modules', (select coalesce(jsonb_agg(e.code), '[]'::jsonb) from equipment e where e.code = any(v.equipment) and e.slot like 'maxi\_%')
      ) order by a.assigned_at)
      from mission_assignments a
      join vehicles v on v.id = a.vehicle_id
      join vehicle_models vm on vm.id = v.model_id
      join organizations o on o.id = a.org_id
      left join bases b on b.id = v.base_id
      where a.mission_id = m.id and a.status <> 'annullata'), '[]'::jsonb)
  )
  from missions m where m.id = p_mission and m.category = 'grande_evento'
$f$;

create or replace function public.maxi_shuttles()
returns table(id uuid, vehicle_id uuid, mission_id uuid, call_sign text, org_name text, org_type text, mine boolean,
              vehicle_image text, lat double precision, lng double precision,
              hospital text, h_lat double precision, h_lng double precision, arrives_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public, extensions as $f$
  select a.id, a.vehicle_id, m.id, v.call_sign, o.name, o.type::text, a.org_id = my_org_id(), vm.image_url,
         st_y(m.location::geometry), st_x(m.location::geometry),
         h.name, st_y(h.location::geometry), st_x(h.location::geometry), a.arrives_at, coalesce(m.event_ends_at, m.expires_at)
  from missions m
  join mission_assignments a on a.mission_id = m.id
  join vehicles v on v.id = a.vehicle_id
  join vehicle_models vm on vm.id = v.model_id
  join organizations o on o.id = a.org_id
  join hospitals h on h.id = nearest_hospital(m.location, null)
  where m.category = 'grande_evento' and m.event_id is null and coalesce(m.venue, '') <> 'AIB'
    and m.status in ('aperta', 'completa', 'in_corso')
    and a.status::text not in ('annullata', 'conclusa', 'rientro') and a.arrives_at <= now()
    and not coalesce(vm.pma, false) and not coalesce(vm.automedica, false) and not coalesce(vm.moto, false)
    and not coalesce(vm.boat, false) and not coalesce(vm.maxi, false)
    and not exists (select 1 from mission_assignments p join vehicles pv on pv.id = p.vehicle_id
                    join vehicle_models pm on pm.id = pv.model_id
                    where p.mission_id = m.id and (coalesce(pm.pma, false) or 'pma_tenda' = any(pv.equipment)) and p.arrives_at <= now()
                      and p.status::text not in ('annullata', 'conclusa', 'rientro'))
$f$;
notify pgrst, 'reload schema';
select 'ESITO mezzi maxi', (select count(*) from vehicle_models where maxi), (select count(*) from equipment where slot like 'maxi\_%');
