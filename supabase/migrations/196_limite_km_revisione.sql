-- 196 (12/11/2026): limite chilometrico per le emergenze + revisione generale.
-- Ambulanze "convertibili" (non ordinarie, automediche, moto, barche, AIB, passi lunghi): a 400.000 km
-- in emergenza (odometer_km - overhaul_km) diventano da sole "solo ordinari" (km_retired + converted_ordinaria)
-- e non si possono riportare a emergenza a mano (set_vehicle_ordinaria -> KM_LIMIT).
-- overhaul_vehicle(id): da 300.000 km (o se già oltre il limite), costo 100.000 + 2 x prezzo modello:
-- overhaul_km = odometer_km, usura 0, torna emergenza. I km totali restano.
alter table public.vehicles add column if not exists overhaul_km numeric not null default 0;
alter table public.vehicles add column if not exists km_retired boolean not null default false;
alter table public.vehicles add column if not exists overhauled_at timestamptz;
create or replace function public.km_limit_emergency() returns int language sql immutable as $$ select 400000 $$;
create or replace function public.vehicle_km_convertible(p_model uuid) returns boolean language sql stable as $$
  select coalesce((select not (ordinaria or boat or automedica or moto or aib or transfer_only) from public.vehicle_models where id = p_model), false)
$$;
create or replace function public.overhaul_cost(p_vehicle uuid) returns int language sql stable security definer set search_path = public as $$
  select (100000 + 2 * coalesce(m.base_cost, 40000))::int from vehicles v left join vehicle_models m on m.id = v.model_id where v.id = p_vehicle
$$;
create or replace function public.vehicles_km_limit() returns trigger language plpgsql as $$
begin
  if not new.km_retired and new.odometer_km - coalesce(new.overhaul_km, 0) >= public.km_limit_emergency()
     and public.vehicle_km_convertible(new.model_id) then
    new.km_retired := true;
    new.converted_ordinaria := true;
  end if;
  return new;
end $$;
drop trigger if exists vehicles_km_limit on public.vehicles;
create trigger vehicles_km_limit before insert or update of odometer_km, overhaul_km on public.vehicles
  for each row execute function public.vehicles_km_limit();
create or replace function public.overhaul_vehicle(p_vehicle uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); veh vehicles; v_cost int; v_km numeric;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into veh from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if not vehicle_km_convertible(veh.model_id) then raise exception 'NOT_CONVERTIBLE'; end if;
  if veh.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  v_km := veh.odometer_km - coalesce(veh.overhaul_km, 0);
  if v_km < 300000 and not veh.km_retired then raise exception 'OVERHAUL_TOO_EARLY'; end if;
  v_cost := overhaul_cost(p_vehicle);
  perform set_config('app.money_reason', 'Revisione generale ' || veh.call_sign, true);
  update organizations set funds = funds - v_cost where id = v_org and funds >= v_cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  update vehicles set overhaul_km = odometer_km, overhauled_at = now(), wear = 0,
         converted_ordinaria = case when km_retired then false else converted_ordinaria end,
         km_retired = false
   where id = p_vehicle;
  return jsonb_build_object('cost', v_cost);
end $$;
grant execute on function public.overhaul_vehicle(uuid) to authenticated;
grant execute on function public.overhaul_cost(uuid) to authenticated;
do $$ declare src text; begin
  src := replace(pg_get_functiondef('public.set_vehicle_ordinaria(uuid,boolean)'::regprocedure), E'\r\n', E'\n');
  if position('KM_LIMIT' in src) > 0 then return; end if;
  src := replace(src, '  if veh.status <> ''disponibile'' then raise exception ''VEHICLE_BUSY''; end if;',
                      '  if veh.status <> ''disponibile'' then raise exception ''VEHICLE_BUSY''; end if;
  if not p_on and veh.km_retired then raise exception ''KM_LIMIT''; end if;');
  if position('KM_LIMIT' in src) = 0 then raise exception 'patch set_vehicle_ordinaria non applicata'; end if;
  execute src;
end $$;
