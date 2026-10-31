-- =====================================================================
--  FantaSoccorritore — Schema Supabase / PostgreSQL
--  Richiede: PostGIS, pg_cron (estensioni disponibili su Supabase)
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
--  ENUM
-- ---------------------------------------------------------------------
create type org_type           as enum ('pubblica_assistenza','misericordia','croce_rossa','custom');
create type volunteer_role     as enum ('autista','soccorritore_base','soccorritore_avanzato','caposervizio');
create type rarity             as enum ('comune','epica','leggendaria');
create type card_state         as enum ('attiva','riposo','in_servizio','scaduta');
create type certification      as enum ('trasporto','base','avanzata_rianimazione');  -- ordinate: confrontabili con < >
create type vehicle_status     as enum ('disponibile','in_servizio','manutenzione','fuori_servizio');
create type mission_category   as enum ('ordinario','emergenza_118','grande_evento');
create type mission_code       as enum ('nessuno','verde','giallo','rosso');
create type mission_status     as enum ('aperta','completa','in_corso','conclusa','scaduta','annullata');
create type assignment_status  as enum ('in_viaggio','sul_posto','conclusa','annullata');
create type content_source     as enum ('ai','admin','scheduler');

-- ---------------------------------------------------------------------
--  UTENTI & ORGANIZZAZIONI
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 3 and 60),
  type        org_type not null,
  -- personalizzazione grafica: colori, divisa, livrea
  theme       jsonb not null default '{"primary":"#F39200","secondary":"#FFFFFF","uniform":"default","livery":"default"}',
  funds       bigint not null default 10000 check (funds >= 0),
  reputation  integer not null default 0,
  packs_since_legendary integer not null default 0,   -- contatore "pity"
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  SEDI
-- ---------------------------------------------------------------------
create table bases (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  name              text not null,                       -- es. "Livorno Nord"
  location          geography(Point, 4326) not null,
  level             smallint not null default 1 check (level between 1 and 5),
  vehicle_capacity  smallint generated always as (2 + level) stored,
  rest_capacity     smallint generated always as (4 + 2 * level) stored,
  is_headquarters   boolean not null default false,
  built_at          timestamptz not null default now()
);
create index on bases using gist (location);
create unique index one_hq_per_org on bases(org_id) where is_headquarters;

-- ---------------------------------------------------------------------
--  VOLONTARI (catalogo carte) & INVENTARIO
-- ---------------------------------------------------------------------
create table volunteers (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text not null,
  nickname        text,
  role            volunteer_role not null,
  rarity          rarity not null,
  avatar_url      text,
  stat_guida      smallint not null check (stat_guida between 1 and 100),
  stat_soccorso   smallint not null check (stat_soccorso between 1 and 100),
  stat_resilienza smallint not null check (stat_resilienza between 1 and 100),
  pros            text[] not null default '{}',
  cons            text[] not null default '{}',
  -- modificatori meccanici dei tratti, es. {"rosso_fatigue":-0.2,"night_fatigue":0.3}
  trait_mods      jsonb not null default '{}',
  contract_days   smallint,          -- null = default per rarità
  is_pack_eligible boolean not null default true,  -- false = carta speciale solo admin
  source          content_source not null default 'ai',
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

create table weekly_packs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  week_start  date not null,
  opened_at   timestamptz not null default now(),
  unique (org_id, week_start)        -- impedisce il doppio riscatto
);

create table card_inventory (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  volunteer_id       uuid not null references volunteers(id),
  base_id            uuid references bases(id) on delete set null,
  pack_id            uuid references weekly_packs(id),
  state              card_state not null default 'attiva',
  energy             numeric(5,2) not null default 100 check (energy between 0 and 100),
  energy_updated_at  timestamptz not null default now(),   -- energia calcolata "lazy"
  rest_until         timestamptz,                          -- riposo obbligatorio
  acquired_at        timestamptz not null default now(),
  expires_at         timestamptz,                          -- null = permanente
  services_completed integer not null default 0
);
create index on card_inventory(org_id, state);
create index on card_inventory(expires_at) where state <> 'scaduta';

-- ---------------------------------------------------------------------
--  GARAGE: MODELLI, ALLESTITORI, MEZZI
-- ---------------------------------------------------------------------
create table vehicle_models (
  id               uuid primary key default gen_random_uuid(),
  name             text unique not null,      -- 'F-Ducalis', 'M-Sprinterix', 'R-Masteron'
  base_cost        integer not null,
  speed_factor     numeric(3,2) not null default 1.00,   -- moltiplica la velocità media
  base_reliability smallint not null check (base_reliability between 1 and 100),
  base_durability  smallint not null check (base_durability between 1 and 100),
  image_url        text,
  is_active        boolean not null default true
);

create table builders (                     -- allestitori (nomi fittizi)
  id             uuid primary key default gen_random_uuid(),
  name           text unique not null,        -- es. 'Mafra Allestimenti', 'Orionis', 'Alexis'
  cost           integer not null,
  value_score    smallint not null,
  reliability    smallint not null check (reliability between -20 and 30),  -- bonus su modello
  durability     smallint not null check (durability between -20 and 30),
  certification  certification not null,
  bonus          jsonb not null default '{}', -- es. {"reward_mult":0.05,"rosso_fatigue":-0.1}
  is_active      boolean not null default true
);

create table vehicles (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  base_id             uuid not null references bases(id),
  model_id            uuid not null references vehicle_models(id),
  builder_id          uuid not null references builders(id),
  call_sign           text not null,            -- es. "Alfa 12"
  certification       certification not null,
  reliability         smallint not null,
  durability          smallint not null,
  value_score         smallint not null,
  wear                numeric(5,2) not null default 0 check (wear between 0 and 100),
  status              vehicle_status not null default 'disponibile',
  odometer_km         numeric(10,1) not null default 0,
  maintenance_until   timestamptz,
  created_at          timestamptz not null default now()
);
create index on vehicles(org_id, status);

-- ---------------------------------------------------------------------
--  SERVIZI (MISSIONI) & ASSEGNAZIONI
-- ---------------------------------------------------------------------
create table missions (
  id                 uuid primary key default gen_random_uuid(),
  category           mission_category not null,
  code               mission_code not null default 'nessuno',
  title              text not null,
  description        text,
  venue              text,                       -- es. 'Stadio Armando Picchi'
  location           geography(Point, 4326) not null,
  slots_total        smallint not null check (slots_total > 0),
  slots_taken        smallint not null default 0,
  required_roles     jsonb not null,             -- es. {"autista":1,"soccorritore_avanzato":1}
  min_certification  certification not null default 'trasporto',
  duration_minutes   integer not null,
  base_fatigue       numeric(5,2) not null,
  wear_cost          numeric(5,2) not null default 3,
  reward_funds       integer not null,
  reward_reputation  integer not null default 1,
  opens_at           timestamptz not null default now(),
  expires_at         timestamptz not null,       -- oltre: nessuna nuova assegnazione
  status             mission_status not null default 'aperta',
  source             content_source not null default 'ai',
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  check (slots_taken <= slots_total),
  check (expires_at > opens_at)
);
create index on missions using gist (location);
create index on missions(status, expires_at);

create table mission_assignments (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references missions(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  vehicle_id    uuid not null references vehicles(id),
  base_id       uuid not null references bases(id),
  slot_number   smallint not null,
  status        assignment_status not null default 'in_viaggio',
  distance_km   numeric(6,2) not null,
  assigned_at   timestamptz not null default now(),
  arrives_at    timestamptz not null,
  completes_at  timestamptz not null,
  completed_at  timestamptz,
  reward_funds  integer,
  unique (mission_id, slot_number),
  unique (mission_id, org_id)          -- un solo slot per giocatore per servizio
);
create index on mission_assignments(status, completes_at);

create table assignment_crew (
  assignment_id uuid not null references mission_assignments(id) on delete cascade,
  card_id       uuid not null references card_inventory(id),
  role          volunteer_role not null,
  fatigue_applied numeric(5,2),
  primary key (assignment_id, card_id)
);

-- =====================================================================
--  FUNZIONI DI GIOCO
-- =====================================================================

-- Organizzazione del chiamante
create or replace function my_org_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from organizations where owner_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
--  Energia "lazy": nessun cron per ricaricare, si calcola alla lettura.
--  R = 5 pt/ora * (1 + resilienza/200) * bonus livello sede
--  Se la sede è oltre la capacità di riposo -> recupero al 40%.
-- ---------------------------------------------------------------------
create or replace function current_energy(p_card_id uuid) returns numeric
language plpgsql stable as $$
declare
  c record; v record; b record;
  rate numeric; hours numeric; resting_count int;
begin
  select * into c from card_inventory where id = p_card_id;
  if c.state = 'in_servizio' or c.state = 'scaduta' then return c.energy; end if;

  select * into v from volunteers where id = c.volunteer_id;
  rate := 5 * (1 + v.stat_resilienza / 200.0);

  if c.base_id is not null then
    select * into b from bases where id = c.base_id;
    rate := rate * (1 + 0.10 * (b.level - 1));
    select count(*) into resting_count from card_inventory
      where base_id = c.base_id and state = 'riposo';
    if resting_count > b.rest_capacity then rate := rate * 0.4; end if;
  else
    rate := rate * 0.4;                       -- nessuna sede assegnata
  end if;

  hours := extract(epoch from (now() - c.energy_updated_at)) / 3600.0;
  return least(100, c.energy + rate * hours);
end $$;

-- ---------------------------------------------------------------------
--  Fatica di un servizio per una carta
--  F = base * max(0.5, durata_h) * notte(1.5) * (1 - resilienza/200) * (1 + mod_tratti)
-- ---------------------------------------------------------------------
create or replace function mission_fatigue(p_mission_id uuid, p_volunteer_id uuid, p_at timestamptz)
returns numeric language plpgsql stable as $$
declare
  m record; v record; f numeric; local_hour int; mods numeric := 0;
begin
  select * into m from missions where id = p_mission_id;
  select * into v from volunteers where id = p_volunteer_id;

  f := m.base_fatigue * greatest(0.5, m.duration_minutes / 60.0);

  local_hour := extract(hour from p_at at time zone 'Europe/Rome');
  if local_hour >= 22 or local_hour < 6 then
    f := f * 1.5;
    mods := mods + coalesce((v.trait_mods->>'night_fatigue')::numeric, 0);
  end if;
  if m.code = 'rosso' then
    mods := mods + coalesce((v.trait_mods->>'rosso_fatigue')::numeric, 0);
  end if;

  f := f * (1 - v.stat_resilienza / 200.0) * (1 + mods);
  return round(greatest(1, f), 2);
end $$;

-- ---------------------------------------------------------------------
--  CLAIM DI UN SERVIZIO — gestione race condition
--  Tutto in una transazione: se un controllo fallisce, rollback completo.
--  L'aggiornamento condizionale di slots_taken è atomico: due giocatori
--  che cliccano nello stesso millisecondo non possono prendere lo stesso slot.
-- ---------------------------------------------------------------------
create or replace function claim_mission(
  p_mission_id uuid,
  p_vehicle_id uuid,
  p_card_ids   uuid[]
) returns mission_assignments
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id();
  m missions; veh vehicles; b bases;
  card record; role_counts jsonb := '{}'; req record;
  dist_km numeric; speed_kmh numeric; travel_min numeric;
  v_slot smallint; a mission_assignments;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;

  -- 1) Mezzo: blocco riga, proprietà, stato, certificazione
  select * into veh from vehicles where id = p_vehicle_id and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if veh.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if veh.wear >= 80 then raise exception 'VEHICLE_NEEDS_MAINTENANCE'; end if;

  select * into m from missions where id = p_mission_id;
  if veh.certification < m.min_certification then raise exception 'CERTIFICATION_TOO_LOW'; end if;

  -- 2) Equipaggio: blocco righe in ordine (evita deadlock), validazione
  for card in
    select ci.*, vo.role, vo.id as vol_id
    from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
    where ci.id = any(p_card_ids) and ci.org_id = v_org
    order by ci.id
    for update of ci
  loop
    if card.state = 'scaduta' or (card.expires_at is not null and card.expires_at <= now()) then
      raise exception 'CARD_EXPIRED:%', card.id; end if;
    if card.state = 'in_servizio' then raise exception 'CARD_BUSY:%', card.id; end if;
    if card.rest_until is not null and card.rest_until > now() then
      raise exception 'CARD_RESTING:%', card.id; end if;
    if current_energy(card.id) < mission_fatigue(m.id, card.vol_id, now()) then
      raise exception 'CARD_TOO_TIRED:%', card.id; end if;

    role_counts := jsonb_set(role_counts, array[card.role::text],
      to_jsonb(coalesce((role_counts->>card.role::text)::int, 0) + 1));
  end loop;

  if (select count(*) from card_inventory where id = any(p_card_ids) and org_id = v_org)
     <> cardinality(p_card_ids) then raise exception 'INVALID_CARDS'; end if;

  -- Requisiti ruoli (un caposervizio può coprire un posto da soccorritore avanzato, ecc.:
  -- qui la versione rigorosa; la gerarchia si può aggiungere come estensione)
  for req in select key, value::int as n from jsonb_each_text(m.required_roles) loop
    if coalesce((role_counts->>req.key)::int, 0) < req.n then
      raise exception 'MISSING_ROLE:%', req.key; end if;
  end loop;

  -- 3) PRESA DELLO SLOT — operazione atomica "first come, first served"
  update missions
     set slots_taken = slots_taken + 1,
         status = case when slots_taken + 1 = slots_total then 'completa' else status end
   where id = p_mission_id
     and status = 'aperta'
     and now() between opens_at and expires_at
     and slots_taken < slots_total
  returning slots_taken into v_slot;

  if v_slot is null then raise exception 'MISSION_FULL_OR_CLOSED'; end if;

  -- 4) Tempo di intervento dalla sede del mezzo
  select * into b from bases where id = veh.base_id;
  dist_km := st_distance(b.location, m.location) / 1000.0;
  speed_kmh := (case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end)
               * (select speed_factor from vehicle_models where id = veh.model_id);
  travel_min := greatest(3, dist_km / speed_kmh * 60);

  insert into mission_assignments (mission_id, org_id, vehicle_id, base_id, slot_number,
                                   distance_km, arrives_at, completes_at)
  values (m.id, v_org, veh.id, b.id, v_slot, round(dist_km, 2),
          now() + make_interval(mins => travel_min::int),
          now() + make_interval(mins => (travel_min + m.duration_minutes)::int))
  returning * into a;

  insert into assignment_crew (assignment_id, card_id, role)
  select a.id, ci.id, vo.role
  from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
  where ci.id = any(p_card_ids);

  -- congela l'energia attuale prima di entrare in servizio
  update card_inventory
     set energy = current_energy(id), energy_updated_at = now(), state = 'in_servizio'
   where id = any(p_card_ids);

  update vehicles set status = 'in_servizio' where id = veh.id;
  return a;
end $$;

-- ---------------------------------------------------------------------
--  CHIUSURA SERVIZI (pg_cron ogni minuto)
--  Applica fatica, riposo obbligatorio, usura, ricompense.
--  Riposo obbligatorio: max(2h, F/4 ore)
--  Ricompensa: base * moltiplicatore rapidità clamp(1.5 - minuti_viaggio/30, 0.5, 1.5)
-- ---------------------------------------------------------------------
create or replace function complete_due_assignments() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare a record; m missions; cr record; f numeric; travel_min numeric;
        reward int; n int := 0; veh vehicles;
begin
  for a in select * from mission_assignments
           where status in ('in_viaggio','sul_posto') and completes_at <= now()
           for update skip locked
  loop
    select * into m from missions where id = a.mission_id;
    select * into veh from vehicles where id = a.vehicle_id;

    for cr in select ac.card_id, ci.volunteer_id from assignment_crew ac
              join card_inventory ci on ci.id = ac.card_id where ac.assignment_id = a.id
    loop
      f := mission_fatigue(m.id, cr.volunteer_id, a.assigned_at);
      update assignment_crew set fatigue_applied = f
       where assignment_id = a.id and card_id = cr.card_id;
      update card_inventory
         set energy = greatest(0, energy - f),
             energy_updated_at = now(),
             state = case when expires_at is not null and expires_at <= now()
                          then 'scaduta'::card_state else 'riposo'::card_state end,
             rest_until = now() + make_interval(mins => (greatest(2, f / 4) * 60)::int),
             services_completed = services_completed + 1
       where id = cr.card_id;
    end loop;

    -- usura mezzo: wear_cost * (1 - durabilità/200)
    update vehicles
       set wear = least(100, wear + m.wear_cost * (1 - durability / 200.0)),
           odometer_km = odometer_km + a.distance_km * 2,
           status = 'disponibile'
     where id = a.vehicle_id;

    travel_min := extract(epoch from (a.arrives_at - a.assigned_at)) / 60.0;
    reward := round(m.reward_funds
              * least(1.5, greatest(0.5, 1.5 - travel_min / 30.0))
              * (1 + coalesce((select (bonus->>'reward_mult')::numeric
                               from builders where id = veh.builder_id), 0)));

    update organizations set funds = funds + reward,
                             reputation = reputation + m.reward_reputation
     where id = a.org_id;

    update mission_assignments set status = 'conclusa', completed_at = now(),
                                   reward_funds = reward
     where id = a.id;
    n := n + 1;
  end loop;

  -- servizi chiusi: nessuno slot ancora in corso e (pieni o scaduti)
  update missions mm set status = 'conclusa'
   where mm.status in ('aperta','completa','in_corso')
     and (mm.slots_taken = mm.slots_total or mm.expires_at <= now())
     and mm.slots_taken > 0
     and not exists (select 1 from mission_assignments x
                     where x.mission_id = mm.id and x.status <> 'conclusa');
  update missions set status = 'scaduta'
   where status = 'aperta' and expires_at <= now() and slots_taken = 0;

  -- carte in riposo che hanno finito il riposo obbligatorio tornano attive
  update card_inventory set state = 'attiva'
   where state = 'riposo' and rest_until <= now();

  return n;
end $$;

-- ---------------------------------------------------------------------
--  SCADENZA CARTE (pg_cron ogni ora)
--  Comuni 7gg, Epiche 21gg, Leggendarie 42gg (o contract_days della carta).
--  Una carta in servizio scade a fine servizio (gestito sopra).
-- ---------------------------------------------------------------------
create or replace function expire_cards() returns integer
language sql security definer set search_path = public, extensions as $$
  with x as (
    update card_inventory set state = 'scaduta', base_id = null
     where state in ('attiva','riposo') and expires_at is not null and expires_at <= now()
    returning 1)
  select count(*)::int from x
$$;

-- ---------------------------------------------------------------------
--  PACCHETTO SETTIMANALE — 5 carte
--  Probabilità: 80% comune, 17% epica, 3% leggendaria
--  Pity: leggendaria garantita all'ottavo pacchetto senza leggendarie.
-- ---------------------------------------------------------------------
create or replace function open_weekly_pack() returns setof card_inventory
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id(); o organizations; p weekly_packs;
  r numeric; rar rarity; got_legendary boolean := false; vol volunteers; i int;
  days int;
begin
  select * into o from organizations where id = v_org for update;
  insert into weekly_packs (org_id, week_start)
  values (v_org, date_trunc('week', now() at time zone 'Europe/Rome')::date)
  returning * into p;                      -- fallisce se già aperto questa settimana

  for i in 1..5 loop
    r := random();
    rar := case when r < 0.03 then 'leggendaria' when r < 0.20 then 'epica' else 'comune' end;
    if i = 5 and not got_legendary and o.packs_since_legendary >= 7 then rar := 'leggendaria'; end if;
    if rar = 'leggendaria' then got_legendary := true; end if;

    select * into vol from volunteers
     where rarity = rar and is_pack_eligible order by random() limit 1;
    days := coalesce(vol.contract_days,
              case rar when 'comune' then 7 when 'epica' then 21 else 42 end);

    return query
      insert into card_inventory (org_id, volunteer_id, pack_id, base_id, expires_at)
      values (v_org, vol.id, p.id,
              (select id from bases where org_id = v_org and is_headquarters),
              now() + make_interval(days => days))
      returning *;
  end loop;

  update organizations
     set packs_since_legendary = case when got_legendary then 0 else packs_since_legendary + 1 end
   where id = v_org;
end $$;

-- ---------------------------------------------------------------------
--  COSTRUZIONE NUOVA SEDE
--  Costo = 5000 * 1.6^(sedi_possedute - 1)   — distanza minima 3 km dalle proprie sedi
-- ---------------------------------------------------------------------
create or replace function build_base(p_name text, p_lng double precision, p_lat double precision)
returns bases language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); n int; cost bigint;
        pt geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography; b bases;
begin
  perform 1 from organizations where id = v_org for update;
  select count(*) into n from bases where org_id = v_org;
  cost := case when n = 0 then 0 else round(5000 * power(1.6, n - 1)) end;

  if exists (select 1 from bases where org_id = v_org and st_dwithin(location, pt, 3000)) then
    raise exception 'TOO_CLOSE_TO_OWN_BASE'; end if;

  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  insert into bases (org_id, name, location, is_headquarters)
  values (v_org, p_name, pt, n = 0) returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------------
--  MANUTENZIONE MEZZO
--  Durata = usura/10 ore, costo = usura * value_score * 2
-- ---------------------------------------------------------------------
create or replace function start_maintenance(p_vehicle_id uuid) returns vehicles
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); v vehicles; cost int;
begin
  select * into v from vehicles where id = p_vehicle_id and org_id = v_org for update;
  if v.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  cost := round(v.wear * v.value_score * 2);
  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update vehicles set status = 'manutenzione',
         maintenance_until = now() + make_interval(mins => (v.wear * 6)::int)
   where id = v.id returning * into v;
  return v;
end $$;

create or replace function finish_maintenance() returns void
language sql security definer set search_path = public, extensions as $$
  update vehicles set status = 'disponibile', wear = 0, maintenance_until = null
   where status = 'manutenzione' and maintenance_until <= now();
$$;

-- ---------------------------------------------------------------------
--  SCHEDULAZIONE
-- ---------------------------------------------------------------------
select cron.schedule('complete-assignments', '* * * * *',  $$select complete_due_assignments()$$);
select cron.schedule('finish-maintenance',   '* * * * *',  $$select finish_maintenance()$$);
select cron.schedule('expire-cards',         '5 * * * *',  $$select expire_cards()$$);

-- =====================================================================
--  ROW LEVEL SECURITY — il client legge, scrive solo tramite RPC
-- =====================================================================
alter table profiles            enable row level security;
alter table organizations       enable row level security;
alter table bases               enable row level security;
alter table volunteers          enable row level security;
alter table card_inventory      enable row level security;
alter table weekly_packs        enable row level security;
alter table vehicle_models      enable row level security;
alter table builders            enable row level security;
alter table vehicles            enable row level security;
alter table missions            enable row level security;
alter table mission_assignments enable row level security;
alter table assignment_crew     enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- Dati pubblici (mappa condivisa e cataloghi)
create policy "read all orgs"      on organizations       for select to authenticated using (true);
create policy "read all bases"     on bases               for select to authenticated using (true);
create policy "read missions"      on missions            for select to authenticated using (true);
create policy "read assignments"   on mission_assignments for select to authenticated using (true);
create policy "read catalog vol"   on volunteers          for select to authenticated using (true);
create policy "read models"        on vehicle_models      for select to authenticated using (true);
create policy "read builders"      on builders            for select to authenticated using (true);
create policy "read all vehicles"  on vehicles            for select to authenticated using (true);

-- Dati privati del giocatore
create policy "own profile"  on profiles       for select using (id = auth.uid());
create policy "own cards"    on card_inventory for select using (org_id = my_org_id());
create policy "own packs"    on weekly_packs   for select using (org_id = my_org_id());
create policy "own crew"     on assignment_crew for select using (
  exists (select 1 from mission_assignments a where a.id = assignment_id and a.org_id = my_org_id()));

-- Personalizzazioni consentite direttamente
create policy "edit own org theme" on organizations for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- (in produzione: limitare le colonne aggiornabili con una RPC update_org_theme)

-- Admin: scrittura completa sui cataloghi e sui servizi
create policy "admin volunteers" on volunteers     for all using (is_admin()) with check (is_admin());
create policy "admin models"     on vehicle_models for all using (is_admin()) with check (is_admin());
create policy "admin builders"   on builders       for all using (is_admin()) with check (is_admin());
create policy "admin missions"   on missions       for all using (is_admin()) with check (is_admin());

-- Realtime: pubblica le tabelle della mappa condivisa
alter publication supabase_realtime add table missions, mission_assignments, vehicles, bases;
