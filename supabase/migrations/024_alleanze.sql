-- ALLEANZE: prestito di ambulanze e volontari tra alleati + acquisto di un'altra associazione.

-- ---------- Alleanze ----------
create table if not exists alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 40),
  founder_org uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists alliance_members (
  org_id uuid primary key references organizations(id) on delete cascade,
  alliance_id uuid not null references alliances(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create table if not exists alliance_invites (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references alliances(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (alliance_id, org_id)
);

-- ---------- Prestiti ----------
create table if not exists vehicle_loans (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  from_org uuid not null references organizations(id) on delete cascade,
  to_org uuid not null references organizations(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  returned_at timestamptz
);
create table if not exists card_loans (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references card_inventory(id) on delete cascade,
  from_org uuid not null references organizations(id) on delete cascade,
  to_org uuid not null references organizations(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  returned_at timestamptz
);

-- ---------- Offerte di acquisto ----------
create table if not exists acquisition_offers (
  id uuid primary key default gen_random_uuid(),
  buyer_org uuid not null references organizations(id) on delete cascade,
  seller_org uuid not null references organizations(id) on delete cascade,
  price bigint not null check (price >= 1000),
  status text not null default 'in_attesa' check (status in ('in_attesa','accettata','rifiutata','annullata')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table alliances enable row level security;
alter table alliance_members enable row level security;
alter table alliance_invites enable row level security;
alter table vehicle_loans enable row level security;
alter table card_loans enable row level security;
alter table acquisition_offers enable row level security;
drop policy if exists "read alliances" on alliances;
drop policy if exists "read members" on alliance_members;
drop policy if exists "read invites" on alliance_invites;
drop policy if exists "read vloans" on vehicle_loans;
drop policy if exists "read cloans" on card_loans;
drop policy if exists "read offers" on acquisition_offers;
create policy "read alliances" on alliances for select to authenticated using (true);
create policy "read members" on alliance_members for select to authenticated using (true);
create policy "read invites" on alliance_invites for select to authenticated
  using (org_id = my_org_id() or alliance_id = (select alliance_id from alliance_members where org_id = my_org_id()));
create policy "read vloans" on vehicle_loans for select to authenticated using (my_org_id() in (from_org, to_org));
create policy "read cloans" on card_loans for select to authenticated using (my_org_id() in (from_org, to_org));
create policy "read offers" on acquisition_offers for select to authenticated using (my_org_id() in (buyer_org, seller_org));
grant select on alliances, alliance_members, alliance_invites, vehicle_loans, card_loans, acquisition_offers to authenticated;

-- ---------- Funzioni di supporto ----------
create or replace function my_alliance() returns uuid language sql stable security definer set search_path = public as $$
  select alliance_id from alliance_members where org_id = my_org_id() $$;

create or replace function same_alliance(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from alliance_members x join alliance_members y on y.alliance_id = x.alliance_id
                 where x.org_id = a and y.org_id = b) $$;

create or replace function vehicle_borrower(p_vehicle uuid) returns uuid language sql stable security definer set search_path = public as $$
  select to_org from vehicle_loans where vehicle_id = p_vehicle and returned_at is null and ends_at > now()
  order by starts_at desc limit 1 $$;

create or replace function card_borrower(p_card uuid) returns uuid language sql stable security definer set search_path = public as $$
  select to_org from card_loans where card_id = p_card and returned_at is null and ends_at > now()
  order by starts_at desc limit 1 $$;

-- Può usarlo chi lo possiede (se non l'ha prestato) oppure chi l'ha in prestito
create or replace function can_use_vehicle(p_vehicle uuid, p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(vehicle_borrower(p_vehicle), (select org_id from vehicles where id = p_vehicle)) = p_org $$;

create or replace function can_use_card(p_card uuid, p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(card_borrower(p_card), (select org_id from card_inventory where id = p_card)) = p_org $$;

-- Volontari prestati: li vede anche chi li riceve
drop policy if exists "borrowed cards" on card_inventory;
create policy "borrowed cards" on card_inventory for select to authenticated using (card_borrower(id) = my_org_id());

create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, v.role, v.rarity, v.gender, v.avatar_url,
       v.stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato,
       case when ci.org_id = my_org_id() then (select name from organizations where id = card_borrower(ci.id)) end as lent_to,
       case when ci.org_id <> my_org_id() then (select name from organizations where id = ci.org_id) end as lent_from
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id() or card_borrower(ci.id) = my_org_id();

-- I mezzi che posso vedere: i miei (anche prestati) e quelli che ho in prestito
create or replace view my_fleet with (security_invoker = true) as
select v.id, v.call_sign, v.status, v.wear, v.certification, v.equipment, v.base_id, v.org_id,
       v.org_id = my_org_id() as mine,
       (select name from organizations where id = vehicle_borrower(v.id) and v.org_id = my_org_id()) as lent_to,
       case when v.org_id <> my_org_id() then (select name from organizations where id = v.org_id) end as lent_from
from vehicles v
where v.org_id = my_org_id() or vehicle_borrower(v.id) = my_org_id();
grant select on my_fleet to authenticated;

-- ---------- Alleanza: crea, invita, entra, esci ----------
create or replace function create_alliance(p_name text) returns alliances
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); a alliances;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if exists (select 1 from alliance_members where org_id = v_org) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
  insert into alliances (name, founder_org) values (trim(p_name), v_org) returning * into a;
  insert into alliance_members (org_id, alliance_id) values (v_org, a.id);
  return a;
end $$;

create or replace function invite_to_alliance(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare al uuid := my_alliance();
begin
  if al is null then raise exception 'NO_ALLIANCE'; end if;
  if exists (select 1 from alliance_members where org_id = p_org) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
  insert into alliance_invites (alliance_id, org_id) values (al, p_org) on conflict do nothing;
end $$;

create or replace function answer_alliance_invite(p_invite uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare i alliance_invites;
begin
  select * into i from alliance_invites where id = p_invite and org_id = my_org_id();
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_accept then
    if exists (select 1 from alliance_members where org_id = i.org_id) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
    insert into alliance_members (org_id, alliance_id) values (i.org_id, i.alliance_id);
    delete from alliance_invites where org_id = i.org_id;
  else
    delete from alliance_invites where id = i.id;
  end if;
end $$;

create or replace function leave_alliance() returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); al uuid := my_alliance();
begin
  if al is null then return; end if;
  -- i prestiti con gli ex alleati finiscono
  update vehicle_loans set returned_at = now() where returned_at is null and v_org in (from_org, to_org);
  update card_loans set returned_at = now() where returned_at is null and v_org in (from_org, to_org);
  delete from alliance_members where org_id = v_org;
  if not exists (select 1 from alliance_members where alliance_id = al) then delete from alliances where id = al; end if;
end $$;

-- ---------- Prestiti ----------
create or replace function lend_vehicle(p_vehicle uuid, p_to uuid, p_hours int) returns vehicle_loans
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v vehicles; l vehicle_loans;
begin
  select * into v from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not same_alliance(v_org, p_to) or p_to = v_org then raise exception 'NOT_ALLY'; end if;
  if v.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if vehicle_borrower(v.id) is not null then raise exception 'ALREADY_LENT'; end if;
  insert into vehicle_loans (vehicle_id, from_org, to_org, ends_at)
  values (v.id, v_org, p_to, now() + make_interval(hours => greatest(1, least(168, p_hours)))) returning * into l;
  return l;
end $$;

create or replace function lend_card(p_card uuid, p_to uuid, p_hours int) returns card_loans
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); c card_inventory; l card_loans;
begin
  select * into c from card_inventory where id = p_card and org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not same_alliance(v_org, p_to) or p_to = v_org then raise exception 'NOT_ALLY'; end if;
  if c.state in ('in_servizio','scaduta') then raise exception 'CARD_BUSY'; end if;
  if card_borrower(c.id) is not null then raise exception 'ALREADY_LENT'; end if;
  insert into card_loans (card_id, from_org, to_org, ends_at)
  values (c.id, v_org, p_to, now() + make_interval(hours => greatest(1, least(168, p_hours)))) returning * into l;
  return l;
end $$;

-- Chi presta o chi riceve può chiudere il prestito (se non è in servizio)
create or replace function end_loan(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id();
begin
  if p_kind = 'mezzo' then
    if exists (select 1 from vehicle_loans l join vehicles v on v.id = l.vehicle_id
               where l.id = p_id and v.status = 'in_servizio') then raise exception 'VEHICLE_BUSY'; end if;
    update vehicle_loans set returned_at = now() where id = p_id and returned_at is null and v_org in (from_org, to_org);
  else
    if exists (select 1 from card_loans l join card_inventory c on c.id = l.card_id
               where l.id = p_id and c.state = 'in_servizio') then raise exception 'CARD_BUSY'; end if;
    update card_loans set returned_at = now() where id = p_id and returned_at is null and v_org in (from_org, to_org);
  end if;
end $$;

-- ---------- Acquisto di un'associazione ----------
-- Valore indicativo: mezzi (con usura) + sedi + metà dei volontari comuni
create or replace function org_valuation(p_org uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum((vm.base_cost + b.cost) * (1 - v.wear / 200.0)) from vehicles v
                     join vehicle_models vm on vm.id = v.model_id join builders b on b.id = v.builder_id
                    where v.org_id = p_org), 0)
        + (select count(*) from bases where org_id = p_org) * 8000
        + (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
            where ci.org_id = p_org and vo.rarity = 'comune' and ci.state <> 'scaduta') * 400)::bigint $$;

create or replace function make_acquisition_offer(p_seller uuid, p_price bigint) returns acquisition_offers
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); o acquisition_offers;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_seller = v_org then raise exception 'SELF'; end if;
  if not exists (select 1 from bases where org_id = p_seller) then raise exception 'NOTHING_TO_BUY'; end if;
  if (select funds from organizations where id = v_org) < p_price then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if exists (select 1 from acquisition_offers where buyer_org = v_org and seller_org = p_seller and status = 'in_attesa') then
    raise exception 'OFFER_EXISTS'; end if;
  insert into acquisition_offers (buyer_org, seller_org, price) values (v_org, p_seller, p_price) returning * into o;
  return o;
end $$;

create or replace function cancel_acquisition_offer(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update acquisition_offers set status = 'annullata', decided_at = now()
   where id = p_id and buyer_org = my_org_id() and status = 'in_attesa' $$;

create or replace function answer_acquisition_offer(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare o acquisition_offers; v_seller uuid := my_org_id(); n_common int; n_moved int := 0; n_gone int := 0;
        n_veh int; n_bases int; buyer_hq uuid;
begin
  select * into o from acquisition_offers where id = p_id and seller_org = v_seller and status = 'in_attesa' for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if not p_accept then
    update acquisition_offers set status = 'rifiutata', decided_at = now() where id = o.id;
    return jsonb_build_object('accettata', false);
  end if;

  -- niente vendita con servizi in corso
  if exists (select 1 from mission_assignments where org_id = v_seller and status <> 'conclusa')
     or exists (select 1 from vehicles where org_id = v_seller and status = 'in_servizio')
     or exists (select 1 from card_inventory where org_id = v_seller and state = 'in_servizio') then
    raise exception 'SELLER_BUSY'; end if;

  perform 1 from organizations where id in (o.buyer_org, o.seller_org) order by id for update;
  update organizations set funds = funds - o.price where id = o.buyer_org and funds >= o.price;
  if not found then raise exception 'BUYER_NO_FUNDS'; end if;
  update organizations set funds = funds + o.price where id = v_seller;

  -- tutti i prestiti del venditore finiscono
  update vehicle_loans set returned_at = now() where returned_at is null and v_seller in (from_org, to_org);
  update card_loans set returned_at = now() where returned_at is null and v_seller in (from_org, to_org);

  -- sedi e ambulanze passano al compratore (le sedi comprate non sono sede centrale)
  update bases set org_id = o.buyer_org, is_headquarters = false where org_id = v_seller;
  get diagnostics n_bases = row_count;
  update vehicles set org_id = o.buyer_org where org_id = v_seller;
  get diagnostics n_veh = row_count;
  select id into buyer_hq from bases where org_id = o.buyer_org and is_headquarters;

  -- volontari comuni: metà passano al compratore (senza doppioni), gli altri lasciano
  select count(*) into n_common from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
   where ci.org_id = v_seller and vo.rarity = 'comune';
  with pool as (
    select ci.id, ci.volunteer_id, row_number() over (order by random()) rn
      from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
     where ci.org_id = v_seller and vo.rarity = 'comune' and ci.state <> 'scaduta'
       and ci.volunteer_id not in (select volunteer_id from card_inventory where org_id = o.buyer_org and state <> 'scaduta'))
  update card_inventory c set org_id = o.buyer_org, base_id = coalesce(buyer_hq, c.base_id)
    from pool where pool.id = c.id and pool.rn <= ceil(n_common / 2.0);
  get diagnostics n_moved = row_count;

  delete from assignment_crew where card_id in (
    select ci.id from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
     where ci.org_id = v_seller and vo.rarity = 'comune');
  delete from card_inventory ci using volunteers vo
   where vo.id = ci.volunteer_id and ci.org_id = v_seller and vo.rarity = 'comune';
  get diagnostics n_gone = row_count;

  -- epiche e leggendarie restano al venditore, senza sede (ne sceglierà una nuova)
  update card_inventory set base_id = null where org_id = v_seller;

  update acquisition_offers set status = 'accettata', decided_at = now() where id = o.id;
  update acquisition_offers set status = 'annullata', decided_at = now()
   where status = 'in_attesa' and (seller_org = v_seller or buyer_org = v_seller);

  return jsonb_build_object('accettata', true, 'prezzo', o.price, 'sedi', n_bases, 'mezzi', n_veh,
                            'volontari_passati', n_moved, 'volontari_andati_via', n_gone);
end $$;

grant execute on function create_alliance(text), invite_to_alliance(uuid), answer_alliance_invite(uuid, boolean),
  leave_alliance(), lend_vehicle(uuid, uuid, int), lend_card(uuid, uuid, int), end_loan(text, uuid),
  org_valuation(uuid), make_acquisition_offer(uuid, bigint), cancel_acquisition_offer(uuid),
  answer_acquisition_offer(uuid, boolean) to authenticated;

-- ---------- Uso dei prestiti nei servizi ----------
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('can_use_vehicle' in src) = 0 then
    src := replace(src, 'select * into veh from vehicles where id = p_vehicle_id and org_id = v_org for update;',
                        'select * into veh from vehicles where id = p_vehicle_id and can_use_vehicle(id, v_org) for update;');
    src := replace(src, 'where ci.id = any(p_card_ids) and ci.org_id = v_org',
                        'where ci.id = any(p_card_ids) and can_use_card(ci.id, v_org)');
    src := replace(src, 'select count(*) from card_inventory where id = any(p_card_ids) and org_id = v_org',
                        'select count(*) from card_inventory where id = any(p_card_ids) and can_use_card(id, v_org)');
    execute src;
  end if;

  src := pg_get_functiondef('travel_estimate(uuid,uuid)'::regprocedure);
  src := replace(src, 'v.org_id = my_org_id()', 'can_use_vehicle(v.id, my_org_id())');
  execute src;

  -- chi presta guadagna anche lui: 15% per l'ambulanza, 5% per ogni volontario (bonus del gioco)
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  if position('bonus prestito' in src) = 0 then
    src := replace(src, '     where id = a.org_id;
',
'     where id = a.org_id;
    -- bonus prestito
    if veh.org_id <> a.org_id then
      update organizations set funds = funds + round(reward * 0.15) where id = veh.org_id;
    end if;
    update organizations og set funds = funds + x.bonus
      from (select ci.org_id, round(reward * 0.05) * count(*) as bonus
              from assignment_crew ac join card_inventory ci on ci.id = ac.card_id
             where ac.assignment_id = a.id and ci.org_id <> a.org_id group by ci.org_id) x
     where og.id = x.org_id;
');
    execute src;
  end if;
end $do$;

select position('can_use_vehicle' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as servizi_ok,
       position('bonus prestito' in pg_get_functiondef('complete_due_assignments()'::regprocedure)) > 0 as bonus_ok,
       position('can_use_vehicle' in pg_get_functiondef('travel_estimate(uuid,uuid)'::regprocedure)) > 0 as stima_ok;
