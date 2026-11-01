-- GRANDI EVENTI: postazioni sanitarie a partite, concerti e spettacoli reali.
-- L'admin inserisce gli eventi; 2 ore prima dell'inizio compaiono sulla mappa come servizi da prenotare
-- (chiusura alle ore dell'inizio). Il mezzo resta in postazione fino a 15 minuti dopo la fine.

create table if not exists venues (
  id        uuid primary key default gen_random_uuid(),
  name      text unique not null,
  location  geography(Point, 4326) not null
);

create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  kind           text not null check (kind in ('calcio','basket','teatro','concerto','altro')),
  venue_id       uuid not null references venues(id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  slots          smallint not null default 1 check (slots between 1 and 10),
  required_roles jsonb not null default '{"autista":1,"soccorritore_base":1}',
  requires       text[] not null default '{defib}',
  reward_funds   integer not null,
  time_confirmed boolean not null default true,   -- false = orario indicativo
  show_at        timestamptz,                     -- inizio vero (fischio d'inizio, sipario)
  source_url     text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists events_starts_idx on events(starts_at);

alter table missions add column if not exists event_id uuid references events(id) on delete set null;
alter table missions add column if not exists event_ends_at timestamptz;
create unique index if not exists missions_one_per_event on missions(event_id) where event_id is not null;

alter table venues enable row level security;
alter table events enable row level security;
drop policy if exists "read venues" on venues;
create policy "read venues" on venues for select using (true);
drop policy if exists "read events" on events;
create policy "read events" on events for select using (true);
drop policy if exists "admin venues" on venues;
create policy "admin venues" on venues for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin events" on events;
create policy "admin events" on events for all to authenticated using (is_admin()) with check (is_admin());
grant select on venues, events to anon, authenticated;
grant insert, update, delete on venues, events to authenticated;

-- Luoghi di Livorno (coordinate modificabili dall'admin)
insert into venues (name, location) values
  ('Stadio Armando Picchi',  st_setsrid(st_makepoint(10.3181, 43.5278), 4326)::geography),
  ('Modigliani Forum',       st_setsrid(st_makepoint(10.3420, 43.5552), 4326)::geography),
  ('PalaMacchia',            st_setsrid(st_makepoint(10.3330, 43.5437), 4326)::geography),
  ('Teatro Goldoni',         st_setsrid(st_makepoint(10.3133, 43.5514), 4326)::geography),
  ('Duomo di Livorno',       st_setsrid(st_makepoint(10.3096, 43.5506), 4326)::geography)
on conflict (name) do nothing;

-- Vista per la mappa e il pannello: eventi con coordinate
create or replace view events_map with (security_invoker = true) as
select e.*, v.name as venue, st_y(v.location::geometry) as lat, st_x(v.location::geometry) as lng
from events e join venues v on v.id = e.venue_id;
grant select on events_map to anon, authenticated;

create or replace view venues_map with (security_invoker = true) as
select id, name, st_y(location::geometry) as lat, st_x(location::geometry) as lng from venues;
grant select on venues_map to anon, authenticated;

-- Funzioni admin per i luoghi (con coordinate)
create or replace function admin_upsert_venue(p_id uuid, p_name text, p_lat double precision, p_lng double precision)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_id is null then
    insert into venues (name, location) values (p_name, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
    returning id into v_id;
  else
    update venues set name = p_name, location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function admin_upsert_venue(uuid, text, double precision, double precision) to authenticated;

-- Ogni 5 minuti: gli eventi che iniziano entro 2 ore diventano servizi prenotabili
create or replace function events_to_missions() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_id, event_ends_at)
  select 'grande_evento', 'nessuno', e.title,
         case e.kind when 'calcio' then 'Postazione sanitaria allo stadio'
                     when 'basket' then 'Postazione sanitaria al palazzetto'
                     when 'concerto' then 'Postazione sanitaria al concerto'
                     when 'teatro' then 'Postazione sanitaria a teatro'
                     else 'Postazione sanitaria' end
         || coalesce(' · inizio ' || to_char(e.show_at at time zone 'Europe/Rome', 'HH24:MI'), '')
         || case when e.time_confirmed then '' else ' (orario indicativo)' end,
         v.name, v.location, e.slots, e.required_roles, 'avanzata_rianimazione',
         greatest(30, extract(epoch from (e.ends_at - e.starts_at)) / 60)::int,
         6, e.reward_funds, 3, e.requires, now(), e.starts_at, 'scheduler', e.id, e.ends_at
  from events e join venues v on v.id = e.venue_id
  where now() >= e.starts_at - interval '2 hours' and now() < e.starts_at
    and not exists (select 1 from missions m where m.event_id = e.id)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
select cron.unschedule('events-to-missions') where exists (select 1 from cron.job where jobname = 'events-to-missions');
select cron.schedule('events-to-missions', '*/5 * * * *', $$select events_to_missions()$$);

-- claim_mission: nelle postazioni il mezzo resta fino a 15 minuti dopo la fine dell'evento
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('event_ends_at' in src) = 0 then
    src := replace(src,
      'now() + make_interval(secs => (travel_min + m.duration_minutes) * 60))',
      'greatest(now() + make_interval(secs => (travel_min + m.duration_minutes) * 60),
                   coalesce(m.event_ends_at + interval ''15 minutes'', now())))');
    execute src;
  end if;
end $do$;

-- Vista mappa servizi: anche categoria e luogo
drop view if exists missions_map;
create view missions_map with (security_invoker = true) as
select id, category, code, title, description, venue, slots_total, slots_taken, required_roles,
       min_certification, requires, reward_funds, expires_at, status, event_id, event_ends_at,
       st_y(location::geometry) as lat, st_x(location::geometry) as lng
from missions
where status in ('completa','in_corso') or (status = 'aperta' and expires_at > now());
grant select on missions_map to anon, authenticated;
insert into events (title,kind,venue_id,starts_at,ends_at,slots,required_roles,requires,reward_funds,time_confirmed,source_url,show_at) values
('Livorno – Ostiamare (Serie C)','calcio',(select id from venues where name='Stadio Armando Picchi'),'2026-11-01 16:30 Europe/Rome','2026-11-01 19:40 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',6000,true,'https://www.corrieredellosport.it/squadra/calcio/livorno/calendario/t1580','2026-11-01 17:30 Europe/Rome'),
('Livorno – Ravenna (Serie C)','calcio',(select id from venues where name='Stadio Armando Picchi'),'2026-11-22 13:30 Europe/Rome','2026-11-22 16:40 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',6000,true,'https://www.corrieredellosport.it/squadra/calcio/livorno/calendario/t1580','2026-11-22 14:30 Europe/Rome'),
('Livorno – Vis Pesaro (Serie C)','calcio',(select id from venues where name='Stadio Armando Picchi'),'2026-12-04 19:30 Europe/Rome','2026-12-04 22:40 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',6000,true,'https://www.corrieredellosport.it/squadra/calcio/livorno/calendario/t1580','2026-12-04 20:30 Europe/Rome'),
('Livorno – Gubbio (Serie C)','calcio',(select id from venues where name='Stadio Armando Picchi'),'2026-12-19 16:30 Europe/Rome','2026-12-19 19:40 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',6000,true,'https://www.corrieredellosport.it/squadra/calcio/livorno/calendario/t1580','2026-12-19 17:30 Europe/Rome'),
('Libertas Livorno – Sella Cento (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-11-08 17:15 Europe/Rome','2026-11-08 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-11-08 18:00 Europe/Rome'),
('Libertas Livorno – Valtur Brindisi (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-11-11 19:45 Europe/Rome','2026-11-11 22:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-11-11 20:30 Europe/Rome'),
('Libertas Livorno – Banco di Sardegna Sassari (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-11-22 17:15 Europe/Rome','2026-11-22 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-11-22 18:00 Europe/Rome'),
('Libertas Livorno – Ruvo di Puglia (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-12-06 17:15 Europe/Rome','2026-12-06 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-12-06 18:00 Europe/Rome'),
('Libertas Livorno – Gesteco Cividale (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-12-16 19:45 Europe/Rome','2026-12-16 22:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-12-16 20:30 Europe/Rome'),
('Libertas Livorno – Victoria Libertas Pesaro (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-12-23 19:45 Europe/Rome','2026-12-23 22:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-12-23 20:30 Europe/Rome'),
('Libertas Livorno – Sebastiani Rieti (A2)','basket',(select id from venues where name='Modigliani Forum'),'2026-12-30 19:45 Europe/Rome','2026-12-30 22:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://static.legapallacanestro.com/sites/default/files/editor/calendario_serie_a2_oww_2026-27.pdf','2026-12-30 20:30 Europe/Rome'),
('Pielle Livorno – Lucca (Serie B)','basket',(select id from venues where name='PalaMacchia'),'2026-11-15 17:15 Europe/Rome','2026-11-15 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://www.losservatore.com/2026/08/05/esordio-a-quarrata-derby-toscani-e-finale-di-stagione-al-palamacchia-contro-montecatini/','2026-11-15 18:00 Europe/Rome'),
('Pielle Livorno – Virtus Roma (Serie B)','basket',(select id from venues where name='PalaMacchia'),'2026-11-29 17:15 Europe/Rome','2026-11-29 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://www.losservatore.com/2026/08/05/esordio-a-quarrata-derby-toscani-e-finale-di-stagione-al-palamacchia-contro-montecatini/','2026-11-29 18:00 Europe/Rome'),
('Pielle Livorno – Ravenna (Serie B)','basket',(select id from venues where name='PalaMacchia'),'2026-12-13 17:15 Europe/Rome','2026-12-13 20:15 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',3500,false,'https://www.losservatore.com/2026/08/05/esordio-a-quarrata-derby-toscani-e-finale-di-stagione-al-palamacchia-contro-montecatini/','2026-12-13 18:00 Europe/Rome'),
('Nayt in concerto','concerto',(select id from venues where name='Modigliani Forum'),'2026-11-01 19:30 Europe/Rome','2026-11-01 23:30 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',5000,true,'https://www.modiglianiforum.com/tutti-eventi/','2026-11-01 21:00 Europe/Rome'),
('Enrico Nigiotti in concerto','concerto',(select id from venues where name='Modigliani Forum'),'2026-11-21 19:30 Europe/Rome','2026-11-21 23:30 Europe/Rome',2,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',5000,true,'https://www.modiglianiforum.com/tutti-eventi/','2026-11-21 21:00 Europe/Rome'),
('Dido and Aeneas (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-06 20:30 Europe/Rome','2026-11-06 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-06 21:00 Europe/Rome'),
('Dido and Aeneas (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-08 20:30 Europe/Rome','2026-11-08 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-08 21:00 Europe/Rome'),
('Peter Hammill (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-11 20:30 Europe/Rome','2026-11-11 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-11 21:00 Europe/Rome'),
('La prima di Mahler (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-12 20:30 Europe/Rome','2026-11-12 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-12 21:00 Europe/Rome'),
('Premio Ciampi 2026 (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-13 20:30 Europe/Rome','2026-11-13 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-13 21:00 Europe/Rome'),
('Gran Galà Händel (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-14 20:30 Europe/Rome','2026-11-14 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-14 21:00 Europe/Rome'),
('Cambiamo musica (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-15 20:30 Europe/Rome','2026-11-15 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-15 21:00 Europe/Rome'),
('Pinocchio (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-19 20:30 Europe/Rome','2026-11-19 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-19 21:00 Europe/Rome'),
('Gaber – Mi fa male il mondo (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-11-24 20:30 Europe/Rome','2026-11-24 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-11-24 21:00 Europe/Rome'),
('L''Adriano in Siria (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-05 20:30 Europe/Rome','2026-12-05 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-05 21:00 Europe/Rome'),
('Buon compleanno, Mascagni (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-07 20:30 Europe/Rome','2026-12-07 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-07 21:00 Europe/Rome'),
('Symphonic Musicals (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-11 20:30 Europe/Rome','2026-12-11 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-11 21:00 Europe/Rome'),
('Symphonic Musicals (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-12 20:30 Europe/Rome','2026-12-12 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-12 21:00 Europe/Rome'),
('Morte accidentale di un anarchico (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-15 20:30 Europe/Rome','2026-12-15 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-15 21:00 Europe/Rome'),
('Lo Schiaccianoci (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-18 20:30 Europe/Rome','2026-12-18 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-18 21:00 Europe/Rome'),
('Vinicio Capossela (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-19 20:30 Europe/Rome','2026-12-19 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-19 21:00 Europe/Rome'),
('L''angelo del focolare (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-22 20:30 Europe/Rome','2026-12-22 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-22 21:00 Europe/Rome'),
('Valerio Lundini & i Vazzanikki (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-30 20:30 Europe/Rome','2026-12-30 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-30 21:00 Europe/Rome'),
('Ultimo dell''anno sulle note di Morricone (Teatro Goldoni)','teatro',(select id from venues where name='Teatro Goldoni'),'2026-12-31 20:30 Europe/Rome','2026-12-31 23:45 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-31 21:00 Europe/Rome'),
('Concerto di Natale (Duomo)','concerto',(select id from venues where name='Duomo di Livorno'),'2026-12-19 19:30 Europe/Rome','2026-12-19 23:00 Europe/Rome',1,'{"autista": 1, "soccorritore_base": 1, "soccorritore_avanzato": 1}'::jsonb,'{defib}',2500,false,'https://www.goldoniteatro.it/spettacoli/','2026-12-19 21:00 Europe/Rome');
select events_to_missions();
