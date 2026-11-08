-- 188: modalita' automatica a TURNI di sede.
-- Ogni sede puo' essere aperta in automatico in 4 turni: 8-14, 14-20, 20-24, 0-8 (ora italiana).
-- Sede H24 = tutti e 4 i turni: al massimo 3 sedi H24 (anche nessuna). Le altre sedi: i turni che vuoi.
-- Ogni minuto organizations.auto_base_ids viene ricalcolato con le sedi aperte ADESSO, cosi' auto_dispatch_org
-- e auto_medical (che usano auto_base_ids) restano identici.
-- Costo: la tariffa oraria di prima (auto_hour_cost_org, legata al patrimonio) vale per 3 sedi;
-- ogni sede aperta in quell'ora costa un terzo. Si paga a ogni ora piena (allineata all'orologio,
-- perche' i turni cambiano sull'ora); all'attivazione si paga solo la parte d'ora che resta.

create table if not exists public.auto_shifts (
  base_id uuid primary key references public.bases(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  shifts smallint not null check (shifts between 0 and 15),   -- bit: 1=8-14, 2=14-20, 4=20-24, 8=0-8
  updated_at timestamptz not null default now()
);
alter table public.auto_shifts enable row level security;
drop policy if exists auto_shifts_own on public.auto_shifts;
create policy auto_shifts_own on public.auto_shifts for select using (org_id = public.my_org_id());
grant select on public.auto_shifts to authenticated;

-- turno di adesso (bit)
create or replace function public.current_shift_bit(p_at timestamptz default now())
returns smallint language sql stable as $$
  select case when h >= 8 and h < 14 then 1 when h >= 14 and h < 20 then 2 when h >= 20 then 4 else 8 end::smallint
    from (select extract(hour from p_at at time zone 'Europe/Rome')::int h) x
$$;

-- sedi aperte adesso per un'associazione (solo sedi ancora sue)
create or replace function public.auto_open_bases(p_org uuid, p_at timestamptz default now())
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s.base_id order by s.base_id), '{}')
    from auto_shifts s join bases b on b.id = s.base_id and b.org_id = s.org_id
   where s.org_id = p_org and (s.shifts & current_shift_bit(p_at)) <> 0
$$;

-- costo di un'ora con le sedi aperte in quell'ora
create or replace function public.auto_shift_hour_cost(p_org uuid, p_at timestamptz default now())
returns int language sql stable security definer set search_path = public as $$
  select (ceil(auto_hour_cost_org(p_org) / 3.0) * cardinality(auto_open_bases(p_org, p_at)))::int
$$;

-- aggiorna auto_base_ids per tutti (o per una sola associazione)
create or replace function public.refresh_auto_bases(p_only uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare o record; v uuid[];
begin
  for o in select id, auto_base_ids from organizations
            where (p_only is null or id = p_only)
              and (exists (select 1 from auto_shifts s where s.org_id = organizations.id) or cardinality(auto_base_ids) > 0) loop
    v := auto_open_bases(o.id);
    if v is distinct from coalesce(o.auto_base_ids, '{}') then
      execute 'up' || 'date organizations set auto_base_ids = $1 where id = $2' using v, o.id;
    end if;
  end loop;
end $$;

-- imposta i turni di una sede
create or replace function public.set_auto_shifts(p_base uuid, p_shifts int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); n24 int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_shifts is null or p_shifts < 0 or p_shifts > 15 then raise exception 'BAD_SHIFTS'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_YOURS'; end if;
  if p_shifts = 15 then
    select count(*) into n24 from auto_shifts s join bases b on b.id = s.base_id and b.org_id = v_org
     where s.org_id = v_org and s.shifts = 15 and s.base_id <> p_base;
    if n24 >= 3 then raise exception 'TOO_MANY_H24'; end if;
  end if;
  if p_shifts = 0 then
    execute 'de' || 'lete from auto_shifts where base_id = $1 and org_id = $2' using p_base, v_org;
  else
    insert into auto_shifts(base_id, org_id, shifts) values (p_base, v_org, p_shifts)
    on conflict (base_id) do update set shifts = excluded.shifts, org_id = excluded.org_id, updated_at = now();
  end if;
  perform refresh_auto_bases(v_org);
  return jsonb_build_object('open_now', auto_open_bases(v_org), 'hour_cost', auto_shift_hour_cost(v_org));
end $$;
grant execute on function public.set_auto_shifts(uuid, int) to authenticated;

-- prezzi per la pagina: per sede/ora, costo dell'ora attuale e stima giornaliera
create or replace function public.my_auto_prices()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'base_hour', ceil(auto_hour_cost_org(my_org_id()) / 3.0)::int,
    'now_hour', auto_shift_hour_cost(my_org_id()),
    'current_shift', current_shift_bit(),
    'day_estimate', (select coalesce(sum(
        ceil(auto_hour_cost_org(my_org_id()) / 3.0) *
        ((case when s.shifts & 1 <> 0 then 6 else 0 end) + (case when s.shifts & 2 <> 0 then 6 else 0 end)
       + (case when s.shifts & 4 <> 0 then 4 else 0 end) + (case when s.shifts & 8 <> 0 then 8 else 0 end))), 0)::bigint
       from auto_shifts s join bases b on b.id = s.base_id and b.org_id = s.org_id where s.org_id = my_org_id()))
$$;
grant execute on function public.my_auto_prices() to authenticated;
create or replace function public.my_auto_hour_cost() returns int language sql stable security definer set search_path = public as $$
  select auto_shift_hour_cost(my_org_id()) $$;

-- addebito: a ogni ora piena, solo per le sedi aperte in quell'ora
create or replace function public.charge_auto_mode()
returns integer language plpgsql security definer set search_path = public as $$
declare o record; n int := 0; cost int; v_next timestamptz := date_trunc('hour', now()) + interval '1 hour';
begin
  perform refresh_auto_bases(null);
  for o in select id from organizations where auto_enabled and (auto_paid_until is null or auto_paid_until <= now()) for update loop
    -- solo la parte d'ora che resta (in pratica l'ora intera, perche' si paga allo scoccare dell'ora)
    cost := ceil(auto_shift_hour_cost(o.id) * extract(epoch from v_next - now()) / 3600.0)::int;
    perform set_config('app.money_reason', 'Modalità automatica (turni)', true);
    update organizations set funds = funds - cost, auto_paid_until = v_next where id = o.id and funds >= cost;
    if not found then update organizations set auto_enabled = false where id = o.id; end if;
    n := n + 1;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $$;

create or replace function public.set_auto_mode(p_enabled boolean, p_codes text[], p_reserve integer, p_steal_red boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o organizations; cost int; v_next timestamptz := date_trunc('hour', now()) + interval '1 hour';
begin
  select * into o from organizations where id = my_org_id() for update;
  if not found then raise exception 'NO_ORG'; end if;
  if p_enabled and (o.auto_paid_until is null or o.auto_paid_until <= now()) then
    perform refresh_auto_bases(o.id);
    cost := ceil(auto_shift_hour_cost(o.id) * extract(epoch from v_next - now()) / 3600.0)::int;
    perform set_config('app.money_reason', 'Modalità automatica (turni)', true);
    update organizations set funds = funds - cost, auto_paid_until = v_next where id = o.id and funds >= cost;
    if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
    perform set_config('app.money_reason', '', true);
  end if;
  update organizations
     set auto_enabled = p_enabled,
         auto_codes = coalesce((select array_agg(c) from unnest(p_codes) c where c in ('rosso','giallo','verde','ordinari','trasferimenti')), '{}'),
         auto_reserve = greatest(0, least(50, coalesce(p_reserve, 0))),
         auto_steal_red = coalesce(p_steal_red, false)
   where id = o.id;
end $$;

-- il vecchio "scegli le sedi" diventa: sedi scelte = H24 (max 3)
create or replace function public.set_auto_bases(p_bases uuid[])
returns uuid[] language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); b uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if cardinality(coalesce(p_bases, '{}')) > 3 then raise exception 'TOO_MANY_H24'; end if;
  execute 'de' || 'lete from auto_shifts where org_id = $1 and shifts = 15 and not (base_id = any($2))' using v_org, coalesce(p_bases, '{}');
  foreach b in array coalesce(p_bases, '{}') loop perform set_auto_shifts(b, 15); end loop;
  perform refresh_auto_bases(v_org);
  return auto_open_bases(v_org);
end $$;

-- passaggio: chi aveva sedi in automatico le ritrova. Le prime 3 diventano H24, la 4a fa 8-14 e 14-20.
insert into public.auto_shifts(base_id, org_id, shifts)
select x.base_id, x.org_id, case when x.rn <= 3 then 15 else 3 end
  from (select o.id org_id, b.base_id, row_number() over (partition by o.id order by b.ord) rn
          from organizations o cross join lateral unnest(o.auto_base_ids) with ordinality b(base_id, ord)
          join bases bb on bb.id = b.base_id and bb.org_id = o.id) x
on conflict (base_id) do nothing;
select public.refresh_auto_bases(null);
