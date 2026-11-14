-- 205: nuovi prezzi delle sedi + sedi in affitto (14/11/2026)
-- Acquisto: prima sede gratis, poi 300.000 € + 150.000 € per ogni sede già posseduta, al massimo 3.000.000 €.
-- Affitto: niente prezzo d'acquisto, si paga ogni ora (affitto al giorno = 3% del prezzo d'acquisto, minimo 9.000 €).
--          Si può riscattare (diventa tua) pagando il prezzo d'acquisto fissato al momento dell'affitto.
--          Se non paghi l'affitto si accumula un debito e i mezzi di quella sede non partono finché non lo saldi.
--          Si può restituire (i mezzi fermi tornano alla sede principale).

alter table public.bases add column if not exists rented boolean not null default false;
alter table public.bases add column if not exists rent_daily integer;
alter table public.bases add column if not exists rent_buy_price integer;
alter table public.bases add column if not exists rent_paid_until timestamptz;
alter table public.bases add column if not exists rent_debt bigint not null default 0;
alter table public.bases add column if not exists rent_paid_total bigint not null default 0;

create or replace function public.base_buy_cost(p_owned integer)
returns bigint language sql immutable as $f$
  select case when p_owned <= 0 then 0 else least(3000000, 300000 + 150000 * (p_owned - 1)) end::bigint
$f$;

create or replace function public.base_rent_daily(p_buy bigint)
returns integer language sql immutable as $f$
  select greatest(9000, round(p_buy * 0.03))::int
$f$;

-- prezzi per la prossima sede della mia associazione
create or replace function public.my_base_prices()
returns jsonb language sql stable security definer set search_path = public as $f$
  select jsonb_build_object('owned', n, 'buy', base_buy_cost(n), 'rent_daily', base_rent_daily(base_buy_cost(greatest(n, 1))))
    from (select count(*)::int n from bases where org_id = my_org_id()) t
$f$;

-- acquisto: stesso controllo di prima, nuovo prezzo
do $d$ declare src text; nw text; begin
  src := replace(pg_get_functiondef('public.build_base(text,double precision,double precision)'::regprocedure), E'\r\n', E'\n');
  nw := replace(src, 'cost := case when n = 0 then 0 else round(5000 * power(1.6, n - 1)) end;', 'cost := base_buy_cost(n);');
  if nw = src then raise exception 'ESITO patch build_base non applicata'; end if;
  execute nw;
end $d$;

-- affitto di una nuova sede (la prima sede si compra, gratis)
create or replace function public.rent_base(p_name text, p_lng double precision, p_lat double precision)
returns bases language plpgsql security definer set search_path = public, extensions as $f$
declare v_org uuid := my_org_id(); n int; buy bigint; daily int;
        pt geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography; b bases;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  perform 1 from organizations where id = v_org for update;
  select count(*) into n from bases where org_id = v_org;
  if n = 0 then raise exception 'FIRST_BASE_NOT_RENTABLE'; end if;
  if exists (select 1 from bases where org_id <> v_org and st_dwithin(location, pt, 500)) then
    raise exception 'TOO_CLOSE_TO_OTHER_BASE'; end if;
  buy := base_buy_cost(n); daily := base_rent_daily(buy);
  perform set_config('app.money_reason', 'Affitto sede: primo giorno', true);
  update organizations set funds = funds - daily where id = v_org and funds >= daily;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  insert into bases (org_id, name, location, is_headquarters, rented, rent_daily, rent_buy_price, rent_paid_until, rent_paid_total)
  values (v_org, coalesce(nullif(trim(p_name), ''), 'Sede in affitto'), pt, false, true, daily, buy, now() + interval '1 day', daily)
  returning * into b;
  return b;
end $f$;

-- addebito orario degli affitti (chiamato dal cron "base-rent")
create or replace function public.charge_base_rent()
returns integer language plpgsql security definer set search_path = public as $f$
declare b record; h int; due bigint; n int := 0;
begin
  for b in select * from bases where rented and rent_paid_until <= now() for update skip locked loop
    h := least(72, greatest(1, ceil(extract(epoch from now() - b.rent_paid_until) / 3600.0)::int));
    due := ceil(b.rent_daily / 24.0) * h + b.rent_debt;
    perform set_config('app.money_reason', 'Affitto sede: ' || b.name, true);
    update organizations set funds = funds - due where id = b.org_id and funds >= due;
    if found then
      update bases set rent_debt = 0, rent_paid_total = rent_paid_total + due,
                       rent_paid_until = rent_paid_until + make_interval(hours => h)
       where id = b.id;
    else
      update bases set rent_debt = due,
                       rent_paid_until = rent_paid_until + make_interval(hours => h)
       where id = b.id;
    end if;
    n := n + 1;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $f$;

-- paga subito il debito d'affitto di una sede
create or replace function public.pay_base_rent_debt(p_base uuid)
returns bigint language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id(); b bases;
begin
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if b.rent_debt <= 0 then return 0; end if;
  perform set_config('app.money_reason', 'Affitto sede (arretrati): ' || b.name, true);
  update organizations set funds = funds - b.rent_debt where id = v_org and funds >= b.rent_debt;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  update bases set rent_paid_total = rent_paid_total + rent_debt, rent_debt = 0 where id = p_base;
  return b.rent_debt;
end $f$;

-- riscatto: la sede in affitto diventa tua
create or replace function public.buyout_base(p_base uuid)
returns bigint language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id(); b bases; tot bigint;
begin
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if not b.rented then raise exception 'NOT_RENTED'; end if;
  tot := b.rent_buy_price + b.rent_debt;
  perform set_config('app.money_reason', 'Riscatto sede: ' || b.name, true);
  update organizations set funds = funds - tot where id = v_org and funds >= tot;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  update bases set rented = false, rent_debt = 0, rent_paid_until = null where id = p_base;
  return tot;
end $f$;

-- restituzione: i mezzi fermi e i volontari tornano alla sede principale
create or replace function public.release_base(p_base uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id(); b bases; hq uuid;
begin
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if not b.rented then raise exception 'NOT_RENTED'; end if;
  if b.rent_debt > 0 then raise exception 'RENT_DEBT'; end if;
  if exists (select 1 from vehicles where base_id = p_base and status <> 'disponibile') then raise exception 'VEHICLES_BUSY'; end if;
  select id into hq from bases where org_id = v_org and id <> p_base order by is_headquarters desc, built_at limit 1;
  if hq is null then raise exception 'NO_OTHER_BASE'; end if;
  update vehicles set base_id = hq where base_id = p_base;
  update card_inventory set base_id = hq where base_id = p_base;
  perform scrap_base(p_base);
end $f$;

-- le sedi in affitto non si vendono, non si regalano e non si scambiano
create or replace function public.bases_rented_guard()
returns trigger language plpgsql as $f$
begin
  if old.rented and new.org_id is distinct from old.org_id then raise exception 'RENTED_BASE'; end if;
  return new;
end $f$;
drop trigger if exists bases_rented_guard on public.bases;
create trigger bases_rented_guard before update of org_id on public.bases for each row execute function public.bases_rented_guard();

create or replace function public.base_auctions_rented_guard()
returns trigger language plpgsql as $f$
begin
  if exists (select 1 from bases where id = new.base_id and rented) then raise exception 'RENTED_BASE'; end if;
  return new;
end $f$;
drop trigger if exists base_auctions_rented_guard on public.base_auctions;
create trigger base_auctions_rented_guard before insert on public.base_auctions for each row execute function public.base_auctions_rented_guard();

-- valore di mercato di una sede comprata: 150.000 € + ampliamenti
create or replace function public.base_market_value(p_base uuid)
returns integer language sql stable security definer set search_path = public as $f$
  select (150000 + coalesce((select sum(base_upgrade_cost(l)) from generate_series(1, b.level - 1) l), 0))::int from bases b where b.id = p_base
$f$;

-- con l'affitto non pagato i mezzi di quella sede non partono
do $d$ declare src text; nw text; anchor text := '  if veh.converted_ordinaria and not (m.category';
begin
  src := replace(pg_get_functiondef('public.claim_mission_as(uuid,uuid,uuid,uuid[])'::regprocedure), E'\r\n', E'\n');
  if position(anchor in src) = 0 then raise exception 'ESITO ancora claim_mission_as non trovata'; end if;
  nw := replace(src, anchor, '  if exists (select 1 from bases where id = veh.base_id and rent_debt > 0) then raise exception ''BASE_RENT_UNPAID''; end if;' || E'\n' || anchor);
  execute nw;
end $d$;

grant execute on function public.my_base_prices(), public.rent_base(text, double precision, double precision), public.pay_base_rent_debt(uuid),
  public.buyout_base(uuid), public.release_base(uuid) to authenticated;
revoke execute on function public.charge_base_rent() from public, anon, authenticated;
notify pgrst, 'reload schema';
select 'ESITO ok: prezzi ' || base_buy_cost(1) || ' / ' || base_buy_cost(5) || ' / ' || base_buy_cost(30) || ', affitto giorno ' || base_rent_daily(base_buy_cost(5));
