-- CARBURANTE: i mezzi consumano gasolio a ogni servizio. Si compra al benzinaio (prezzo reale, medio
-- nazionale self Mimit) e finisce nella cisterna dell'associazione; da lì si fa il pieno ai mezzi.
-- Con meno di 5 litri (riserva) il mezzo non può partire.

-- Consumi e serbatoi (ambulanze allestite, valori realistici)
alter table vehicle_models add column if not exists tank_liters smallint not null default 80;
alter table vehicle_models add column if not exists consumption_l100 numeric not null default 12;
update vehicle_models set tank_liters = 80, consumption_l100 = 12.0 where name = 'R-Masteron';
update vehicle_models set tank_liters = 90, consumption_l100 = 11.5 where name = 'F-Ducalis';
update vehicle_models set tank_liters = 93, consumption_l100 = 12.5 where name = 'M-Sprinterix';
update vehicle_models set tank_liters = 75, consumption_l100 = 12.0 where name = 'V-Craftor';
update vehicle_models set tank_liters = 93, consumption_l100 = 13.5 where name = 'M-Sprinterix XL';

-- Litri nel serbatoio di ogni mezzo (i mezzi esistenti partono col pieno)
alter table vehicles add column if not exists fuel_liters numeric not null default 80;
update vehicles v set fuel_liters = vm.tank_liters from vehicle_models vm where vm.id = v.model_id;
alter table vehicles drop constraint if exists vehicles_fuel_check;
alter table vehicles add constraint vehicles_fuel_check check (fuel_liters >= 0);

-- I mezzi nuovi escono dal concessionario col pieno
create or replace function vehicle_full_tank() returns trigger language plpgsql
set search_path to 'public' as $$
begin
  new.fuel_liters := coalesce((select tank_liters from vehicle_models where id = new.model_id), 80);
  return new;
end $$;
drop trigger if exists vehicles_full_tank on vehicles;
create trigger vehicles_full_tank before insert on vehicles for each row execute function vehicle_full_tank();

-- Cisterna dell'associazione: 1.000 litri per ogni sede
alter table organizations add column if not exists fuel_stock numeric not null default 0;
alter table organizations drop constraint if exists organizations_fuel_stock_check;
alter table organizations add constraint organizations_fuel_stock_check check (fuel_stock >= 0);

-- Prezzo alla pompa (aggiornabile dall'admin)
create table if not exists fuel_prices (
  fuel text primary key,
  price_eur numeric not null check (price_eur > 0),
  source text,
  updated_at timestamptz not null default now()
);
alter table fuel_prices enable row level security;
drop policy if exists "read fuel prices" on fuel_prices;
create policy "read fuel prices" on fuel_prices for select to authenticated using (true);
drop policy if exists "admin fuel prices" on fuel_prices;
create policy "admin fuel prices" on fuel_prices for all using (is_admin()) with check (is_admin());
insert into fuel_prices (fuel, price_eur, source)
values ('gasolio', 2.260, 'Mimit, prezzo medio self rete stradale, 23/10/2026')
on conflict (fuel) do update set price_eur = excluded.price_eur, source = excluded.source, updated_at = now();

create or replace function fuel_capacity(p_org uuid) returns numeric language sql stable
set search_path to 'public' as $$
  select 1000 * greatest(1, (select count(*) from bases where org_id = p_org))::numeric
$$;

-- Litri consumati da un servizio (strada ≈ linea d'aria × 1,3)
create or replace function trip_fuel(p_assignment uuid) returns numeric language plpgsql stable
set search_path to 'public', 'extensions' as $$
declare a mission_assignments; m missions; b bases; f hospitals; t hospitals; km numeric; cons numeric;
begin
  select * into a from mission_assignments where id = p_assignment;
  select * into m from missions where id = a.mission_id;
  select * into b from bases where id = a.base_id;
  if m.transport = 'trasferimento' then
    select * into f from hospitals where id = m.hospital_from_id;
    select * into t from hospitals where id = m.hospital_to_id;
    km := (st_distance(b.location, f.location) + st_distance(f.location, t.location) + st_distance(t.location, b.location)) / 1000.0 * 1.3;
  else
    km := a.distance_km * 2 * 1.3;
  end if;
  select vm.consumption_l100 into cons from vehicles v join vehicle_models vm on vm.id = v.model_id where v.id = a.vehicle_id;
  return round(km * coalesce(cons, 12) / 100.0, 2);
end $$;

-- Comprare gasolio al benzinaio
create or replace function buy_fuel(p_liters integer) returns jsonb language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v_org uuid := my_org_id(); o organizations; price numeric; cost bigint; cap numeric;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_liters is null or p_liters < 1 then raise exception 'BAD_LITERS'; end if;
  select * into o from organizations where id = v_org for update;
  cap := fuel_capacity(v_org);
  if o.fuel_stock + p_liters > cap then raise exception 'TANK_TOO_SMALL:%', floor(cap - o.fuel_stock); end if;
  select price_eur into price from fuel_prices where fuel = 'gasolio';
  cost := ceil(p_liters * price);
  update organizations set funds = funds - cost, fuel_stock = fuel_stock + p_liters
   where id = v_org and funds >= cost returning * into o;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  return jsonb_build_object('liters', p_liters, 'cost', cost, 'stock', o.fuel_stock, 'funds', o.funds);
end $$;

-- Fare il pieno ai mezzi dalla cisterna (uso interno: anche la modalità automatica)
create or replace function refuel_org_vehicles(p_org uuid, p_vehicle uuid default null, p_below numeric default 1)
returns numeric language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v record; stock numeric; need numeric; total numeric := 0;
begin
  select fuel_stock into stock from organizations where id = p_org for update;
  for v in
    select vv.id, vv.fuel_liters, vm.tank_liters from vehicles vv join vehicle_models vm on vm.id = vv.model_id
     where vv.org_id = p_org and (p_vehicle is null or vv.id = p_vehicle)
       and vv.status in ('disponibile', 'manutenzione')
       and vv.fuel_liters < vm.tank_liters * p_below
     order by vv.fuel_liters / vm.tank_liters
     for update of vv
  loop
    exit when stock <= 0;
    need := least(v.tank_liters - v.fuel_liters, stock);
    continue when need <= 0;
    update vehicles set fuel_liters = fuel_liters + need where id = v.id;
    stock := stock - need; total := total + need;
  end loop;
  update organizations set fuel_stock = stock where id = p_org;
  return round(total, 1);
end $$;
revoke execute on function refuel_org_vehicles(uuid, uuid, numeric) from public, anon, authenticated;

-- Pieno a un mezzo (o a tutti, se p_vehicle è null)
create or replace function refuel(p_vehicle uuid default null) returns numeric language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v_org uuid := my_org_id(); n numeric;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_vehicle is not null and not exists (select 1 from vehicles where id = p_vehicle and org_id = v_org) then
    raise exception 'VEHICLE_NOT_FOUND'; end if;
  if (select fuel_stock from organizations where id = v_org) <= 0 then raise exception 'NO_FUEL_STOCK'; end if;
  n := refuel_org_vehicles(v_org, p_vehicle, 1);
  if n <= 0 then raise exception 'TANK_FULL'; end if;
  return n;
end $$;

-- Flotta: litri e serbatoio visibili nei pannelli
create or replace view my_fleet with (security_invoker = true) as
 SELECT id,
    call_sign,
        CASE
            WHEN ((status = 'in_servizio'::vehicle_status) AND (NOT (EXISTS ( SELECT 1
               FROM mission_assignments a
              WHERE ((a.vehicle_id = v.id) AND (a.status <> 'conclusa'::assignment_status) AND (a.completes_at > now())))))) THEN 'disponibile'::vehicle_status
            ELSE status
        END AS status,
    wear,
    certification,
    equipment,
    base_id,
    org_id,
    (org_id = my_org_id()) AS mine,
    ( SELECT organizations.name
           FROM organizations
          WHERE ((organizations.id = vehicle_borrower(v.id)) AND (v.org_id = my_org_id()))) AS lent_to,
        CASE
            WHEN (org_id <> my_org_id()) THEN ( SELECT organizations.name
               FROM organizations
              WHERE (organizations.id = v.org_id))
            ELSE NULL::text
        END AS lent_from,
    maintenance_until,
    ( SELECT vehicle_models.image_url
           FROM vehicle_models
          WHERE (vehicle_models.id = v.model_id)) AS vehicle_image,
    ( SELECT bases.name
           FROM bases
          WHERE (bases.id = v.base_id)) AS base_name,
    ( SELECT st_y((bases.location)::geometry) AS st_y
           FROM bases
          WHERE (bases.id = v.base_id)) AS base_lat,
    ( SELECT st_x((bases.location)::geometry) AS st_x
           FROM bases
          WHERE (bases.id = v.base_id)) AS base_lng,
    COALESCE(( SELECT vm.transfer_only
           FROM vehicle_models vm
          WHERE (vm.id = v.model_id)), false) AS transfer_only,
    fuel_liters,
    ( SELECT vm.tank_liters FROM vehicle_models vm WHERE (vm.id = v.model_id)) AS tank_liters
   FROM vehicles v
  WHERE ((org_id = my_org_id()) OR (vehicle_borrower(id) = my_org_id()));

-- Patch alle funzioni di gioco
do $do$
declare src text; fn text;
begin
  -- 1) a fine servizio il mezzo consuma gasolio
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  if position('fuel_liters' in src) = 0 then
    src := replace(src, 'odometer_km = odometer_km + a.distance_km * 2,',
                        'odometer_km = odometer_km + a.distance_km * 2,
           fuel_liters = greatest(0, fuel_liters - trip_fuel(a.id)),');
    if position('fuel_liters' in src) = 0 then raise exception 'patch complete_due_assignments fallita'; end if;
    execute src;
  end if;

  -- 2) in riserva (sotto 5 litri) il mezzo non parte
  foreach fn in array array['claim_mission(uuid,uuid,uuid[])', 'claim_mission_as(uuid,uuid,uuid,uuid[])'] loop
    src := pg_get_functiondef(fn::regprocedure);
    if position('NO_FUEL' in src) = 0 then
      src := replace(src, 'raise exception ''VEHICLE_NEEDS_MAINTENANCE''; end if;',
                          'raise exception ''VEHICLE_NEEDS_MAINTENANCE''; end if;
  if veh.fuel_liters < 5 then raise exception ''NO_FUEL''; end if;');
      if position('NO_FUEL' in src) = 0 then raise exception 'patch % fallita', fn; end if;
      execute src;
    end if;
  end loop;

  -- 3) modalità automatica: pieno dalla cisterna sotto il 25% e niente partenze in riserva
  src := pg_get_functiondef('auto_dispatch()'::regprocedure);
  if position('fuel_liters' in src) = 0 then
    src := replace(src, 'vv.wear < 80', 'vv.wear < 80 and vv.fuel_liters >= 5');
    src := replace(src, 'for o in select * from organizations where auto_enabled and cardinality(auto_codes) > 0 loop',
                        'for o in select * from organizations where auto_enabled and cardinality(auto_codes) > 0 loop
    perform refuel_org_vehicles(o.id, null, 0.25);');
    if position('refuel_org_vehicles' in src) = 0 then raise exception 'patch auto_dispatch fallita'; end if;
    execute src;
  end if;
end $do$;
