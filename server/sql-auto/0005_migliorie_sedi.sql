-- 206: migliorie delle sedi (14/11/2026). Ogni miglioria ha 3 livelli; effetti per sede.
--  solare      Pannelli solari        → risparmio in bolletta (entrata ogni ora)
--  caldaia     Caldaia nuova          → risparmio ogni ora + volontari si riposano un po' prima
--  volontari   Area volontari         → riposo più corto e premio servizi un po' più alto
--  officina    Officina interna       → i mezzi della sede si usurano meno
--  radio       Centrale radio         → premio dei servizi più alto per i mezzi della sede
--  bar         Bar sociale / punto raccolta fondi → entrata ogni ora
--  Tinteggiatura: colore della sede (si vede sulla mappa); i colori chiari riflettono il sole → piccolo risparmio.

create table if not exists public.base_perk_catalog (
  kind text not null, level int not null, name text not null, icon text not null, cost int not null,
  income_h int not null default 0, effect text not null, primary key (kind, level)
);
alter table public.base_perk_catalog enable row level security;
drop policy if exists base_perk_catalog_read on public.base_perk_catalog;
create policy base_perk_catalog_read on public.base_perk_catalog for select using (true);
grant select on public.base_perk_catalog to anon, authenticated;

insert into public.base_perk_catalog (kind, level, name, icon, cost, income_h, effect) values
 ('solare', 1, 'Pannelli solari 10 kW', '☀️', 150000, 1500, '+1.500 €/ora di risparmio in bolletta'),
 ('solare', 2, 'Pannelli solari 30 kW', '☀️', 350000, 3500, '+3.500 €/ora di risparmio in bolletta'),
 ('solare', 3, 'Solare 60 kW + batterie', '☀️', 650000, 6000, '+6.000 €/ora di risparmio in bolletta'),
 ('caldaia', 1, 'Caldaia a condensazione', '🔥', 80000, 800, '+800 €/ora di risparmio, volontari riposano il 5% prima'),
 ('caldaia', 2, 'Pompa di calore', '🔥', 220000, 2000, '+2.000 €/ora di risparmio, riposo −10%'),
 ('caldaia', 3, 'Geotermico', '🔥', 450000, 3500, '+3.500 €/ora di risparmio, riposo −15%'),
 ('volontari', 1, 'Sala relax', '🛋️', 100000, 0, 'Riposo dei volontari −10%, premio servizi +1%'),
 ('volontari', 2, 'Cucina e spogliatoi', '🛋️', 250000, 0, 'Riposo −20%, premio servizi +2%'),
 ('volontari', 3, 'Dormitorio e palestra', '🛋️', 500000, 0, 'Riposo −30%, premio servizi +3%'),
 ('officina', 1, 'Officina interna', '🔧', 120000, 0, 'Usura dei mezzi della sede −10%'),
 ('officina', 2, 'Officina con ponte sollevatore', '🔧', 280000, 0, 'Usura −20%'),
 ('officina', 3, 'Officina e autolavaggio', '🔧', 550000, 0, 'Usura −30%'),
 ('radio', 1, 'Postazione radio', '📡', 150000, 0, 'Premio dei servizi dei mezzi della sede +2%'),
 ('radio', 2, 'Centrale operativa', '📡', 350000, 0, 'Premio servizi +4%'),
 ('radio', 3, 'Centrale con ponte radio', '📡', 700000, 0, 'Premio servizi +6%'),
 ('bar', 1, 'Bar sociale', '☕', 90000, 1000, '+1.000 €/ora da bar e donazioni'),
 ('bar', 2, 'Sala eventi', '☕', 230000, 2500, '+2.500 €/ora'),
 ('bar', 3, 'Centro di raccolta fondi', '☕', 480000, 4500, '+4.500 €/ora')
on conflict (kind, level) do update set name = excluded.name, icon = excluded.icon, cost = excluded.cost,
  income_h = excluded.income_h, effect = excluded.effect;

create table if not exists public.base_perks (
  base_id uuid not null references public.bases(id) on delete cascade,
  kind text not null, level int not null default 0, updated_at timestamptz not null default now(),
  primary key (base_id, kind)
);
alter table public.base_perks enable row level security;
drop policy if exists base_perks_read on public.base_perks;
create policy base_perks_read on public.base_perks for select to authenticated
  using (exists (select 1 from public.bases b where b.id = base_id and b.org_id = public.my_org_id()));
grant select on public.base_perks to authenticated;

alter table public.bases add column if not exists color text;

create or replace function public.base_perk_level(p_base uuid, p_kind text)
returns int language sql stable security definer set search_path = public as $f$
  select coalesce((select level from base_perks where base_id = p_base and kind = p_kind), 0)
$f$;

-- colori chiari: riflettono il sole, piccolo risparmio
create or replace function public.base_color_light(p_color text)
returns boolean language sql immutable as $f$
  select coalesce(p_color in ('#FFFFFF', '#FEF3C7', '#FDE68A', '#E0F2FE', '#DCFCE7'), false)
$f$;

create or replace function public.base_rest_factor(p_base uuid)
returns numeric language sql stable security definer set search_path = public as $f$
  select greatest(0.55, 1 - 0.10 * base_perk_level(p_base, 'volontari') - 0.05 * base_perk_level(p_base, 'caldaia'))
$f$;

create or replace function public.base_wear_factor(p_base uuid)
returns numeric language sql stable security definer set search_path = public as $f$
  select 1 - 0.10 * base_perk_level(p_base, 'officina')
$f$;

create or replace function public.base_reward_bonus(p_base uuid)
returns numeric language sql stable security definer set search_path = public as $f$
  select 0.01 * base_perk_level(p_base, 'volontari') + 0.02 * base_perk_level(p_base, 'radio')
$f$;

-- entrata oraria di una sede (risparmi + bar + tinteggiatura chiara)
create or replace function public.base_income_h(p_base uuid)
returns int language sql stable security definer set search_path = public as $f$
  select (coalesce((select sum(c.income_h) from base_perks p join base_perk_catalog c on c.kind = p.kind and c.level = p.level
                     where p.base_id = p_base), 0)
          + case when base_color_light((select color from bases where id = p_base)) then 600 else 0 end)::int
$f$;

-- compra il livello successivo di una miglioria
create or replace function public.buy_base_perk(p_base uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id(); b bases; lv int; c base_perk_catalog;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  lv := base_perk_level(p_base, p_kind);
  select * into c from base_perk_catalog where kind = p_kind and level = lv + 1;
  if not found then raise exception 'MAX_LEVEL'; end if;
  perform set_config('app.money_reason', 'Miglioria sede: ' || c.name || ' (' || b.name || ')', true);
  update organizations set funds = funds - c.cost where id = v_org and funds >= c.cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  insert into base_perks (base_id, kind, level) values (p_base, p_kind, lv + 1)
  on conflict (base_id, kind) do update set level = excluded.level, updated_at = now();
  return jsonb_build_object('level', lv + 1, 'name', c.name, 'cost', c.cost);
end $f$;

-- tinteggiatura: 25.000 €
create or replace function public.set_base_color(p_base uuid, p_color text)
returns void language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id();
begin
  if p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'BAD_COLOR'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_FOUND'; end if;
  perform set_config('app.money_reason', 'Tinteggiatura sede', true);
  update organizations set funds = funds - 25000 where id = v_org and funds >= 25000;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', '', true);
  update bases set color = upper(p_color) where id = p_base;
end $f$;

-- colori delle sedi per la mappa
create or replace function public.base_colors()
returns table (id uuid, color text) language sql stable security definer set search_path = public as $f$
  select id, color from bases where color is not null
$f$;

-- entrate orarie delle migliorie (cron "base-perks")
create or replace function public.pay_base_perks()
returns integer language plpgsql security definer set search_path = public as $f$
declare r record; n int := 0;
begin
  perform set_config('app.money_reason', 'Migliorie sedi: risparmi ed entrate', true);
  for r in select b.org_id, sum(base_income_h(b.id)) amt from bases b
            where exists (select 1 from base_perks p where p.base_id = b.id and p.level > 0) or b.color is not null
            group by b.org_id loop
    if r.amt > 0 then update organizations set funds = funds + r.amt where id = r.org_id; n := n + 1; end if;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $f$;

-- effetti nel motore: riposo, usura, premio
do $d$ declare src text; nw text; begin
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  nw := replace(src, $a$then now() + interval '3 hours' else null end$a$, $a$then now() + interval '3 hours' * base_rest_factor(base_id) else null end$a$);
  if nw = src then raise exception 'ESITO patch riposo non applicata'; end if;
  src := nw;
  nw := replace(src, 'wear + m.wear_cost * (1 - durability / 200.0)', 'wear + m.wear_cost * (1 - durability / 200.0) * base_wear_factor(base_id)');
  if nw = src then raise exception 'ESITO patch usura non applicata'; end if;
  src := nw;
  nw := replace(src, 'reward := round(reward * 0.90);', 'reward := round(reward * 0.90);' || E'\n' || '    reward := round(reward * (1 + base_reward_bonus(veh.base_id)));  -- migliorie della sede');
  if nw = src then raise exception 'ESITO patch premio non applicata'; end if;
  execute nw;
end $d$;

grant execute on function public.buy_base_perk(uuid, text), public.set_base_color(uuid, text), public.base_colors(),
  public.base_income_h(uuid) to authenticated;
revoke execute on function public.pay_base_perks() from public, anon, authenticated;
notify pgrst, 'reload schema';
select 'ESITO ok: migliorie ' || count(*) from base_perk_catalog;
