-- TRASFERIMENTI tra ospedali, in Toscana e fuori regione.
alter table hospitals add column if not exists region text not null default 'Toscana';
alter table hospitals add column if not exists specialty text;
alter table hospitals add column if not exists transfer_dest boolean not null default false;

insert into hospitals (name, location, capabilities, region, specialty, transfer_dest) values
  ('Careggi (Firenze)',                 st_setsrid(st_makepoint(11.2487, 43.8017), 4326)::geography, '{}', 'Toscana',        'neurochirurgia', true),
  ('Meyer (Firenze)',                   st_setsrid(st_makepoint(11.2466, 43.8008), 4326)::geography, '{}', 'Toscana',        'pediatria',      true),
  ('Le Scotte (Siena)',                 st_setsrid(st_makepoint(11.3172, 43.3286), 4326)::geography, '{}', 'Toscana',        'trapianti',      true),
  ('San Luca (Lucca)',                  st_setsrid(st_makepoint(10.5390, 43.8540), 4326)::geography, '{}', 'Toscana',        'riabilitazione', true),
  ('Ospedale del Cuore (Massa)',        st_setsrid(st_makepoint(10.1230, 44.0250), 4326)::geography, '{}', 'Toscana',        'cardiochirurgia',true),
  ('Gaslini (Genova)',                  st_setsrid(st_makepoint(8.9719, 44.3906), 4326)::geography,  '{}', 'Liguria',        'pediatria',      true),
  ('San Martino (Genova)',              st_setsrid(st_makepoint(8.9741, 44.4089), 4326)::geography,  '{}', 'Liguria',        'neurochirurgia', true),
  ('Sant''Andrea (La Spezia)',          st_setsrid(st_makepoint(9.8330, 44.1170), 4326)::geography,  '{}', 'Liguria',        'ortopedia',      true),
  ('Niguarda (Milano)',                 st_setsrid(st_makepoint(9.1876, 45.5104), 4326)::geography,  '{}', 'Lombardia',      'grandi ustionati', true),
  ('Gemelli (Roma)',                    st_setsrid(st_makepoint(12.4300, 41.9305), 4326)::geography, '{}', 'Lazio',          'oncologia',      true),
  ('Bambino Gesù (Roma)',               st_setsrid(st_makepoint(12.4594, 41.8961), 4326)::geography, '{}', 'Lazio',          'pediatria',      true),
  ('Sant''Orsola (Bologna)',            st_setsrid(st_makepoint(11.3600, 44.4925), 4326)::geography, '{}', 'Emilia-Romagna', 'trapianti',      true),
  ('Rizzoli (Bologna)',                 st_setsrid(st_makepoint(11.3440, 44.4800), 4326)::geography, '{}', 'Emilia-Romagna', 'ortopedia',      true)
on conflict (name) do nothing;
update hospitals set transfer_dest = true, specialty = 'trauma center' where name = 'Ospedale di Cisanello (Pisa)';

create or replace view hospitals_map with (security_invoker = true) as
select id, name, capabilities, region, specialty, transfer_dest,
       st_y(location::geometry) as lat, st_x(location::geometry) as lng from hospitals;
grant select on hospitals_map to anon, authenticated;

alter table missions add column if not exists hospital_from_id uuid references hospitals(id);
alter table missions add column if not exists hospital_to_id uuid references hospitals(id);

-- Viaggi lunghi: strada ~30% più lunga della linea d'aria
create or replace function leg_road_minutes(a geography, b geography, kmh numeric) returns numeric
language sql immutable set search_path = public, extensions as $$ select greatest(5, st_distance(a, b) / 1000.0 * 1.3 / kmh * 60) $$;

-- Ogni 10 minuti, a volte, un nuovo trasferimento (massimo 2 aperti)
create or replace function generate_transfers() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare o hospitals; d hospitals; r numeric; want_toscana boolean := random() < 0.6; road_km numeric; fuori boolean; protetto boolean; rew int;
begin
  if (select count(*) from missions where transport = 'trasferimento' and status = 'aperta' and expires_at > now()) >= 2 then
    return 0; end if;
  if random() > 0.5 then return 0; end if;

  r := random();
  select * into o from hospitals
   where name = case when r < 0.8 then 'Ospedale di Livorno' when r < 0.9 then 'Ospedale di Cisanello (Pisa)' else 'Ospedale di Cecina' end;
  -- 60% in Toscana, 40% fuori regione
  select * into d from hospitals
   where transfer_dest and id <> o.id and (region = 'Toscana') = want_toscana
   order by random() limit 1;
  if d.id is null then select * into d from hospitals where transfer_dest and id <> o.id order by random() limit 1; end if;
  if o.id is null or d.id is null then return 0; end if;

  road_km := st_distance(o.location, d.location) / 1000.0 * 1.3;
  fuori := d.region <> 'Toscana';
  protetto := random() < 0.4;
  rew := (round((900 + 22 * road_km) * case when fuori then 1.2 else 1 end * case when protetto then 1.15 else 1 end / 100) * 100)::int;

  insert into missions (category, code, title, description, location, slots_total, required_roles, min_certification,
                        duration_minutes, base_fatigue, reward_funds, reward_reputation, requires, transport,
                        hospital_from_id, hospital_to_id, expires_at, source)
  values ('ordinario', 'nessuno',
          'Trasferimento ' || case when fuori then 'fuori regione ' else '' end || '→ ' || d.name,
          o.name || ' → ' || d.name || ' · ' || round(road_km) || ' km · ' || coalesce(d.specialty, '')
            || case when protetto then ' · protetto (medicalizzato)' else '' end,
          o.location, 1,
          case when protetto then '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}'::jsonb
               else '{"autista":1,"soccorritore_base":1}'::jsonb end,
          'trasporto', round(2 * road_km / 85 * 60 + 30)::int, 4, rew, case when fuori then 4 else 2 end,
          case when protetto then '{defib}'::text[] else '{}'::text[] end, 'trasferimento',
          o.id, d.id, now() + interval '5 minutes', 'scheduler');
  return 1;
end $$;
select cron.unschedule(jobname) from cron.job where jobname = 'generate-transfers';
select cron.schedule('generate-transfers', '*/10 * * * *', $$select generate_transfers()$$);

-- claim_mission: percorso del trasferimento (sede → ospedale di partenza → ospedale di arrivo → sede)
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('trasferimento' in src) = 0 then
    src := replace(src, 'a mission_assignments; h hospitals;', 'a mission_assignments; h hospitals; d hospitals;');
    src := replace(src,
      'if m.event_ends_at is not null or m.transport is null then',
      'if m.transport = ''trasferimento'' then
    select * into h from hospitals where id = m.hospital_from_id;
    select * into d from hospitals where id = m.hospital_to_id;
    t1 := t0 + make_interval(secs => leg_minutes(b.location, h.location, v_back) * 60);
    t2 := t1 + interval ''15 minutes'';
    t3 := t2 + make_interval(secs => leg_road_minutes(h.location, d.location, 85 * sf) * 60);
    t4 := t3 + interval ''15 minutes'';
    t5 := t4 + make_interval(secs => leg_road_minutes(d.location, b.location, 85 * sf) * 60);
    v_route := jsonb_build_array(route_point(b.location, t0, ''Sede''), route_point(h.location, t1, h.name),
                                 route_point(h.location, t2, h.name), route_point(d.location, t3, d.name),
                                 route_point(d.location, t4, d.name), route_point(b.location, t5, ''Sede''));
    h := d;
  elsif m.event_ends_at is not null or m.transport is null then');
    execute src;
  end if;
end $do$;

select generate_transfers() as nuovi, (select count(*) from hospitals) as ospedali,
       position('trasferimento' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as percorso_ok;
