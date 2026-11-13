-- 204 (13/11/2026): magazzino presidi (togli/monta/sposta/aggiorna) + scelta uso del mezzo gratuita.

create table if not exists public.org_equipment_stock (
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null references public.equipment(code),
  qty int not null default 0 check (qty >= 0),
  primary key (org_id, code)
);
alter table public.org_equipment_stock enable row level security;
drop policy if exists equipment_stock_read on public.org_equipment_stock;
create policy equipment_stock_read on public.org_equipment_stock for select to authenticated using (org_id = public.my_org_id());
grant select on public.org_equipment_stock to authenticated;

-- mezzo mio, che può ricevere presidi e non è in servizio
create or replace function public._equip_vehicle(p_vehicle uuid, p_org uuid, p_busy_ok boolean default false)
returns public.vehicles language plpgsql security definer set search_path = public, extensions as $f$
declare v vehicles; m vehicle_models;
begin
  select * into v from vehicles where id = p_vehicle and org_id = p_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  select * into m from vehicle_models where id = v.model_id;
  if coalesce(m.boat, false) or coalesce(m.aib, false) then raise exception 'NO_EQUIPMENT_ON_THIS_VEHICLE'; end if;
  if v.status = 'fuori_servizio' or (v.status = 'in_servizio' and not p_busy_ok) then raise exception 'VEHICLE_BUSY'; end if;
  return v;
end $f$;

create or replace function public._equip_save(p_vehicle uuid, p_eq text[])
returns void language sql security definer set search_path = public, extensions as $f$
  update vehicles
     set equipment = p_eq,
         certification = case when 'emergenza' = any(vehicle_provides(p_eq))
                              then 'avanzata_rianimazione'::certification else 'trasporto'::certification end
   where id = p_vehicle;
$f$;

create or replace function public._equip_stock_add(p_org uuid, p_code text, p_n int)
returns void language plpgsql security definer set search_path = public, extensions as $f$
begin
  if p_n >= 0 then
    insert into org_equipment_stock (org_id, code, qty) values (p_org, p_code, p_n)
    on conflict (org_id, code) do update set qty = org_equipment_stock.qty + p_n;
  else
    update org_equipment_stock set qty = qty + p_n where org_id = p_org and code = p_code and qty >= -p_n;
    if not found then raise exception 'NO_STOCK'; end if;
  end if;
end $f$;

-- compra presidi per il magazzino
create or replace function public.equip_buy(p_code text, p_qty int default 1)
returns int language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); e equipment; tot int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into e from equipment where code = p_code;
  if not found then raise exception 'BAD_EQUIPMENT'; end if;
  if p_qty < 1 or p_qty > 200 then raise exception 'BAD_QTY'; end if;
  tot := e.cost * p_qty;
  perform set_config('app.money_reason', 'Presidi: ' || e.name, true);
  update organizations set funds = funds - tot where id = v_org and funds >= tot;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  perform _equip_stock_add(v_org, p_code, p_qty);
  return tot;
end $f$;

-- togli un presidio dal mezzo: torna in magazzino
create or replace function public.equip_remove(p_vehicle uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); v vehicles;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  v := _equip_vehicle(p_vehicle, v_org);
  if not (p_code = any(v.equipment)) then raise exception 'NOT_INSTALLED'; end if;
  perform _equip_save(v.id, array_remove(v.equipment, p_code));
  perform _equip_stock_add(v_org, p_code, 1);
end $f$;

-- monta un presidio: dal magazzino (p_buy = false) o comprandolo nuovo (p_buy = true).
-- Se nello stesso posto c'era già un presidio, quello torna in magazzino (aggiornamento).
create or replace function public.equip_mount(p_vehicle uuid, p_code text, p_buy boolean default false)
returns void language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); v vehicles; e equipment; old text;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into e from equipment where code = p_code;
  if not found then raise exception 'BAD_EQUIPMENT'; end if;
  v := _equip_vehicle(p_vehicle, v_org, true);
  if p_code = any(v.equipment) then raise exception 'ALREADY_INSTALLED'; end if;
  if p_buy then
    perform set_config('app.money_reason', 'Presidi: ' || e.name, true);
    update organizations set funds = funds - e.cost where id = v_org and funds >= e.cost;
    if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
    perform set_config('app.money_reason', '', true);
  else
    perform _equip_stock_add(v_org, p_code, -1);
  end if;
  for old in select c from unnest(v.equipment) c where c in (select code from equipment where slot = e.slot) loop
    perform _equip_stock_add(v_org, old, 1);
  end loop;
  perform _equip_save(v.id, array(select c from unnest(v.equipment) c where c not in (select code from equipment where slot = e.slot)) || p_code);
end $f$;

-- sposta un presidio da un mezzo a un altro
create or replace function public.equip_move(p_from uuid, p_to uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $f$
begin
  if p_from = p_to then raise exception 'SAME_VEHICLE'; end if;
  perform equip_remove(p_from, p_code);
  perform equip_mount(p_to, p_code, false);
end $f$;

-- uso del mezzo, gratis: 'emergenze' | 'ordinari' | 'trasferimenti' (solo passi lunghi)
create or replace function public.set_vehicle_use(p_vehicle uuid, p_use text)
returns void language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); v vehicles; m vehicle_models;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into v from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  select * into m from vehicle_models where id = v.model_id;
  if m.ordinaria or m.boat or m.automedica or m.aib or coalesce(m.moto, false) then raise exception 'USE_FIXED'; end if;
  if v.km_retired and p_use <> 'ordinari' then raise exception 'KM_LIMIT'; end if;
  if p_use = 'ordinari' then
    update vehicles set converted_ordinaria = true, long_emergency = false where id = v.id;
  elsif p_use = 'emergenze' then
    update vehicles set converted_ordinaria = false, long_emergency = coalesce(m.transfer_only, false) where id = v.id;
  elsif p_use = 'trasferimenti' and m.transfer_only then
    update vehicles set converted_ordinaria = false, long_emergency = false where id = v.id;
  else raise exception 'BAD_USE'; end if;
end $f$;

revoke all on function public._equip_vehicle(uuid, uuid, boolean), public._equip_save(uuid, text[]), public._equip_stock_add(uuid, text, int) from public, anon, authenticated;
grant execute on function public.equip_buy(text, int), public.equip_remove(uuid, text), public.equip_mount(uuid, text, boolean),
  public.equip_move(uuid, uuid, text), public.set_vehicle_use(uuid, text) to authenticated;
notify pgrst, 'reload schema';
