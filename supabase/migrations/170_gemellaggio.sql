-- 170: Gemellaggio tra associazioni + donazioni (soldi, ambulanze, sedi).

create table if not exists public.twinnings (
  id uuid primary key default gen_random_uuid(),
  org_a uuid not null references organizations(id) on delete cascade,  -- richiedente
  org_b uuid not null references organizations(id) on delete cascade,  -- invitata
  status text not null default 'in_attesa',                            -- in_attesa | attiva
  created_at timestamptz not null default now(),
  constraint twin_diff check (org_a <> org_b)
);
create unique index if not exists twin_pair_uniq on public.twinnings (least(org_a, org_b), greatest(org_a, org_b));
alter table public.twinnings enable row level security;
drop policy if exists twin_select on public.twinnings;
create policy twin_select on public.twinnings for select to authenticated
  using (org_a = my_org_id() or org_b = my_org_id());

create or replace function public.are_twinned(a uuid, b uuid) returns boolean
 language sql stable security definer set search_path to 'public' as $fn$
  select exists (select 1 from twinnings t where t.status = 'attiva'
    and ((t.org_a = a and t.org_b = b) or (t.org_a = b and t.org_b = a)));
$fn$;

create or replace function public.request_twinning(p_target uuid) returns uuid
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id(); v_id uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_target = v_org then raise exception 'SAME_ORG'; end if;
  if not exists (select 1 from organizations where id = p_target) then raise exception 'ORG_NOT_FOUND'; end if;
  if exists (select 1 from twinnings t where (t.org_a = v_org and t.org_b = p_target) or (t.org_a = p_target and t.org_b = v_org)) then
    raise exception 'ALREADY_TWIN_OR_PENDING'; end if;
  insert into twinnings (org_a, org_b, status) values (v_org, p_target, 'in_attesa') returning id into v_id;
  return v_id;
end $fn$;

create or replace function public.answer_twinning(p_id uuid, p_accept boolean) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare t twinnings;
begin
  select * into t from twinnings where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if t.org_b <> my_org_id() then raise exception 'NOT_INVITED'; end if;
  if p_accept then update twinnings set status = 'attiva' where id = p_id;
  else delete from twinnings where id = p_id; end if;
end $fn$;

create or replace function public.end_twinning(p_id uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare t twinnings;
begin
  select * into t from twinnings where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if my_org_id() not in (t.org_a, t.org_b) then raise exception 'NOT_YOURS'; end if;
  delete from twinnings where id = p_id;
end $fn$;

-- dona soldi al gemello
create or replace function public.gift_funds(p_to uuid, p_amount bigint) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_to) then raise exception 'NOT_TWINNED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  perform 1 from organizations where id = v_org for update;
  perform set_config('app.money_reason', 'Dono al gemellaggio', true);
  update organizations set funds = funds - p_amount where id = v_org and funds >= p_amount;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', 'Dono dal gemellaggio', true);
  update organizations set funds = funds + p_amount where id = p_to;
  perform set_config('app.money_reason', '', true);
end $fn$;

-- dona un'ambulanza al gemello (ferma in sede)
create or replace function public.gift_vehicle(p_vehicle uuid, p_to uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id(); veh vehicles; dest uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_to) then raise exception 'NOT_TWINNED'; end if;
  select * into veh from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if veh.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if vehicle_borrower(veh.id) is not null then raise exception 'VEHICLE_LENT'; end if;
  select id into dest from bases where org_id = p_to order by is_headquarters desc limit 1;
  if dest is null then raise exception 'NO_BASE'; end if;
  update vehicles set org_id = p_to, base_id = dest where id = p_vehicle;
end $fn$;

-- dona una sede (non la principale) al gemello, con i suoi mezzi fermi
create or replace function public.gift_base(p_base uuid, p_to uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id(); b bases;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_to) then raise exception 'NOT_TWINNED'; end if;
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if b.is_headquarters then raise exception 'HQ_NOT_GIFTABLE'; end if;
  if exists (select 1 from vehicles where base_id = p_base and status = 'in_servizio') then raise exception 'BASE_BUSY'; end if;
  update vehicles set org_id = p_to where base_id = p_base;
  update bases set org_id = p_to, is_headquarters = false where id = p_base;
end $fn$;

-- rinomina una sede col nome del gemellaggio (collaborazione)
create or replace function public.twin_rename_base(p_base uuid, p_twin uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_twin) then raise exception 'NOT_TWINNED'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_FOUND'; end if;
  update bases set name = '🤝 ' || (select name from organizations where id = v_org) || ' × ' || (select name from organizations where id = p_twin)
   where id = p_base;
end $fn$;

create or replace view public.my_twinnings as
  select t.id, t.status, t.created_at,
    (case when t.org_a = my_org_id() then t.org_b else t.org_a end) as other_org,
    (select o.name from organizations o where o.id = (case when t.org_a = my_org_id() then t.org_b else t.org_a end)) as other_name,
    (select o.logo_url from organizations o where o.id = (case when t.org_a = my_org_id() then t.org_b else t.org_a end)) as other_logo,
    (select o.type::text from organizations o where o.id = (case when t.org_a = my_org_id() then t.org_b else t.org_a end)) as other_type,
    (t.org_b = my_org_id() and t.status = 'in_attesa') as can_answer,
    (t.org_a = my_org_id() and t.status = 'in_attesa') as i_requested
  from twinnings t where t.org_a = my_org_id() or t.org_b = my_org_id();
grant select on public.my_twinnings to authenticated;

grant execute on function public.are_twinned(uuid,uuid) to authenticated;
grant execute on function public.request_twinning(uuid) to authenticated;
grant execute on function public.answer_twinning(uuid,boolean) to authenticated;
grant execute on function public.end_twinning(uuid) to authenticated;
grant execute on function public.gift_funds(uuid,bigint) to authenticated;
grant execute on function public.gift_vehicle(uuid,uuid) to authenticated;
grant execute on function public.gift_base(uuid,uuid) to authenticated;
grant execute on function public.twin_rename_base(uuid,uuid) to authenticated;
