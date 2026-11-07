-- 162: Incendi boschivi + mezzi e volontari AIB (antincendio boschivo).
-- NB: eseguire PRIMA e da sola la riga ALTER TYPE (nuovo valore enum), poi il resto.
alter type volunteer_role add value if not exists 'aib';

-- 162b1: mezzi e volontari AIB (antincendio boschivo).

alter table vehicle_models add column if not exists aib boolean not null default false;

insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
                            tank_liters, consumption_l100, electric, range_km, aib)
select * from (values
  ('P-Ranger AIB', 36000, 1.00::numeric, 74::smallint, 78::smallint, '/vehicles/aib-ranger.png',
   'Pickup 4x4 antincendio boschivo: modulo acqua e naspo. Solo incendi.', 70::smallint, 11.0::numeric, false, null::smallint, true),
  ('D-Daily AIB', 44000, 0.95, 76, 82, '/vehicles/aib-daily.png',
   'Camioncino 4x4 antincendio: grande riserva d''acqua. Solo incendi.', 90, 14.0, false, null, true),
  ('S-Scorpio AIB', 33000, 1.02, 70, 74, '/vehicles/aib-scorpio.png',
   'Pickup antincendio agile e scattante. Solo incendi.', 65, 10.0, false, null, true)
) v(name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
    tank_liters, consumption_l100, electric, range_km, aib)
where not exists (select 1 from vehicle_models m where m.name = v.name);

-- volontari AIB per le buste (12 comuni, 3 epici, 1 leggendario)
insert into volunteers (first_name, last_name, nickname, role, rarity,
                        stat_guida, stat_soccorso, stat_resilienza, pros, cons, gender, is_pack_eligible, source)
select
  (array['Luca','Marco','Sara','Elena','Paolo','Giulia','Andrea','Chiara','Davide','Anna','Simone','Ilaria','Fabio','Noemi','Pietro','Serena'])[i+1],
  (array['Fiamma','Bosco','Pineta','Faggio','Cerro','Rovere','Castagni','Monti','Valli','Fronda','Resina','Ceppo','Brace','Tizzo','Vampa','Falò'])[i+1],
  (array['Cenere','Scintilla','Idrante','Naspo','Manichetta','Ascia','Roncola','Battifiamma','Fumo','Braciere','Salamandra','Fenice','Vulcano','Tizzone','Lapilli','Prometeo'])[i+1],
  'aib'::volunteer_role, rar,
  (40 + floor(random()*25))::smallint,
  (case rar when 'leggendaria' then 88 when 'epica' then 76 else 55 end + floor(random()* (case rar when 'comune' then 22 else 12 end)))::smallint,
  (case rar when 'leggendaria' then 90 when 'epica' then 80 else 60 end + floor(random()* (case rar when 'comune' then 20 else 10 end)))::smallint,
  array[(array['Non molla mai sul fronte del fuoco','Legge il vento e le fiamme','Instancabile con il naspo','Conosce ogni sentiero nel bosco','Sangue freddo tra le fiamme','Forte come un mulo'])[1+(i%6)]],
  array[(array['Tossisce con troppo fumo','Si scotta facile','Testardo','Ha sempre sete','Odia l''elicottero','Parla poco'])[1+(i%6)]],
  case when i % 2 = 0 then 'm' else 'f' end, true,
  (case when (case when i = 0 then 'leggendaria' when i <= 3 then 'epica' else 'comune' end) = 'comune' then 'ai' else 'admin' end)::content_source
from generate_series(0,15) i
cross join lateral (select (case when i = 0 then 'leggendaria' when i <= 3 then 'epica' else 'comune' end)::rarity as rar) r;

-- acquisto: i mezzi AIB non montano presidi
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.buy_vehicle'::regproc), E'\r\n', E'\n');
  src2 := src;
  src2 := replace(src2, '  if mdl.ordinaria then p_equipment := array[''barella_std'']; end if;',
    '  if mdl.ordinaria then p_equipment := array[''barella_std'']; end if;'||E'\n'||'  if mdl.aib then p_equipment := ''{}''; end if;');
  src2 := replace(src2, '  if n_mon <> 1 and not mdl.ordinaria then raise exception ''NEED_ONE_MONITOR''; end if;',
    '  if n_mon <> 1 and not mdl.ordinaria and not mdl.aib then raise exception ''NEED_ONE_MONITOR''; end if;');
  src2 := replace(src2, '  if n_bar <> 1 and not (mdl.automedica or mdl.boat) then raise exception ''NEED_ONE_STRETCHER''; end if;',
    '  if n_bar <> 1 and not (mdl.automedica or mdl.boat or mdl.aib) then raise exception ''NEED_ONE_STRETCHER''; end if;');
  if src2 = src then raise exception 'buy_vehicle: patch aib non applicata'; end if;
  execute src2;
end $$;

-- my_fleet espone aib
do $$
declare d text;
begin
  d := pg_get_viewdef('public.my_fleet'::regclass, true);
  d := regexp_replace(d, ';\s*$', '');
  if position('AS aib' in d) = 0 then
    d := replace(d, E'AS ordinaria\n   FROM vehicles v',
      E'AS ordinaria,\n    COALESCE(( SELECT vm.aib FROM vehicle_models vm WHERE vm.id = v.model_id), false) AS aib\n   FROM vehicles v');
    if position('AS aib' in d) = 0 then raise exception 'my_fleet: innesto aib non trovato'; end if;
    execute 'create or replace view public.my_fleet as ' || d;
  end if;
end $$;

-- 162b2: motore incendi boschivi.

create table if not exists public.wildfires (
  mission_id uuid primary key references public.missions(id) on delete cascade,
  severity smallint not null,
  intensity numeric not null default 0,   -- 0 domato .. 100 fuori controllo
  base_radius int not null default 400,
  updated_at timestamptz not null default now()
);

-- rotta del mezzo AIB: va al fuoco, poi fa la spola fuoco <-> sede piu' vicina per ricaricare acqua, poi rientra
create or replace function public.aib_fire_route(p_start geography, p_fire geography, p_home geography,
                                                 p_t0 timestamptz, p_end timestamptz, p_speed numeric)
returns jsonb language plpgsql stable set search_path to 'public','extensions' as $fn$
declare r jsonb; t timestamptz; reload geography; i int := 0;
begin
  select location into reload from bases order by st_distance(location, p_fire) limit 1;
  if reload is null then reload := p_home; end if;
  t := p_t0;
  r := jsonb_build_array(route_point(p_start, t, 'Sede'));
  t := t + make_interval(secs => leg_minutes(p_start, p_fire, p_speed) * 60);
  r := r || route_point(p_fire, t, 'Sull''incendio');
  while t < p_end and i < 24 loop
    i := i + 1;
    t := least(p_end, t + interval '4 minutes');
    r := r || route_point(p_fire, t, 'Spegne l''incendio');
    exit when t >= p_end;
    t := t + make_interval(secs => leg_minutes(p_fire, reload, p_speed) * 60);
    r := r || route_point(reload, t, 'Ricarica acqua');
    t := t + interval '2 minutes';
    r := r || route_point(reload, t, 'Ricarica acqua');
    t := t + make_interval(secs => leg_minutes(reload, p_fire, p_speed) * 60);
    r := r || route_point(p_fire, t, 'Sull''incendio');
  end loop;
  t := t + make_interval(secs => leg_minutes(p_fire, p_home, p_speed) * 60);
  r := r || route_point(p_home, t, 'Sede');
  return r;
end $fn$;

-- crea un incendio di gravita' 1..3 vicino a una sede (zona boschiva fuori dal paese)
create or replace function public.spawn_wildfire(p_sev int default null)
returns uuid language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare sev int; bl geography; bname text; loc geography; zname text; mid uuid; hours int;
begin
  sev := coalesce(p_sev, (1 + floor(random()*3))::int);
  select b.location, b.name into bl, bname from bases b
   order by (select count(distinct b2.org_id) from bases b2 where st_dwithin(b2.location, b.location, 25000)) desc, random()
   limit 1;
  if bl is null then return null; end if;
  loc := st_project(bl, 1500 + random()*3000, random()*2*pi());   -- nel bosco, 1,5-4,5 km dalla sede
  select s.name into zname from (
    select comune as name, location from mission_spots where st_dwithin(location, loc, 8000)
    union all select comune, location from italy_spots where st_dwithin(location, loc, 8000)
  ) s order by st_distance(s.location, loc) limit 1;
  zname := coalesce(zname, bname);
  hours := sev * 2;

  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', case when sev = 1 then 'giallo' else 'rosso' end,
          '🔥 Incendio boschivo — ' || zname,
          'Incendio boschivo di gravità ' || sev || '/3. Possono intervenire tutti con i mezzi antincendio: più mezzi mandi, prima lo domate e più guadagnate. Se arrivano in pochi, le fiamme si propagano. Dura circa ' || hours || ' ore.',
          'AIB', loc, 999, '{"aib":2}'::jsonb, 'trasporto', hours*60, 10, 6000 + sev*4000, 6 + sev*2, '{}',
          now(), now() + make_interval(hours => hours), 'scheduler', now() + make_interval(hours => hours))
  returning id into mid;

  insert into wildfires (mission_id, severity, intensity, base_radius)
  values (mid, sev, sev*25, 300 + sev*150);
  return mid;
end $fn$;

-- propagazione: pochi mezzi -> l'incendio cresce; abbastanza mezzi -> si domano le fiamme
create or replace function public.spread_wildfires()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare f record; n int; needed int; new_int numeric;
begin
  for f in select w.*, m.event_ends_at from wildfires w join missions m on m.id = w.mission_id
           where m.status in ('aperta','completa','in_corso') and m.event_ends_at > now() loop
    select count(*) into n from mission_assignments a
      join vehicles v on v.id = a.vehicle_id join vehicle_models vm on vm.id = v.model_id
     where a.mission_id = f.mission_id and vm.aib and a.status in ('in_viaggio','sul_posto');
    needed := f.severity + 1;
    if n >= needed then new_int := greatest(0, f.intensity - (n - needed + 1) * 6);
    else new_int := least(100, f.intensity + (needed - n) * 4); end if;
    update wildfires set intensity = new_int, updated_at = now() where mission_id = f.mission_id;
    -- fuori controllo: l'incendio dura di piu' (max +90 min dalla fine prevista)
    if new_int >= 100 and f.event_ends_at < now() + interval '30 minutes' then
      update missions set event_ends_at = event_ends_at + interval '20 minutes',
                          expires_at = expires_at + interval '20 minutes'
       where id = f.mission_id and event_ends_at < now() + interval '110 minutes';
    end if;
  end loop;
end $fn$;

-- un giro del tick: propaga gli incendi e ogni tanto ne accende uno nuovo (max 2 contemporanei)
create or replace function public.tick_wildfires()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
begin
  perform spread_wildfires();
  if (select count(*) from missions where venue='AIB' and category='grande_evento'
        and status in ('aperta','completa','in_corso') and event_ends_at > now()) < 2
     and coalesce((select max(created_at) from missions where venue='AIB' and category='grande_evento'),
                  now() - interval '1 day') < now() - interval '12 minutes'
     and random() < 0.5 then
    perform spawn_wildfire();
  end if;
end $fn$;

-- cerchio dell'incendio per la mappa (raggio in metri cresce con l'intensita')
create or replace view public.wildfires_map as
  select w.mission_id,
         st_y(m.location::geometry) as lat, st_x(m.location::geometry) as lng,
         w.severity, round(w.intensity)::int as intensity,
         (w.base_radius + round(w.intensity * 18))::int as radius_m,
         m.event_ends_at
    from wildfires w join missions m on m.id = w.mission_id
   where m.status in ('aperta','completa','in_corso') and m.event_ends_at > now();
grant select on public.wildfires_map to anon, authenticated;

-- spawn_wildfire corretto (italy_spots.city, cast mission_code)
create or replace function public.spawn_wildfire(p_sev int default null)
returns uuid language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare sev int; bl geography; bname text; loc geography; zname text; mid uuid; hours int;
begin
  sev := coalesce(p_sev, (1 + floor(random()*3))::int);
  select b.location, b.name into bl, bname from bases b
   order by (select count(distinct b2.org_id) from bases b2 where st_dwithin(b2.location, b.location, 25000)) desc, random()
   limit 1;
  if bl is null then return null; end if;
  loc := st_project(bl, 1500 + random()*3000, random()*2*pi());
  select s.name into zname from (
    select comune as name, location from mission_spots where st_dwithin(location, loc, 8000)
    union all select city as name, location from italy_spots where st_dwithin(location, loc, 8000)
  ) s order by st_distance(s.location, loc) limit 1;
  zname := coalesce(zname, bname);
  hours := sev * 2;
  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', (case when sev = 1 then 'giallo' else 'rosso' end)::mission_code,
          '🔥 Incendio boschivo — ' || zname,
          'Incendio boschivo di gravità ' || sev || '/3. Possono intervenire tutti con i mezzi antincendio: più mezzi mandi, prima lo domate e più guadagnate. Se arrivano in pochi, le fiamme si propagano. Dura circa ' || hours || ' ore.',
          'AIB', loc, 999, '{"aib":2}'::jsonb, 'trasporto', hours*60, 10, 6000 + sev*4000, 6 + sev*2, '{}',
          now(), now() + make_interval(hours => hours), 'scheduler', now() + make_interval(hours => hours))
  returning id into mid;
  insert into wildfires (mission_id, severity, intensity, base_radius) values (mid, sev, sev*25, 300 + sev*150);
  return mid;
end $fn$;

-- 162c: claim (mezzi AIB + rotta con ricarica acqua) + tick + primo incendio.
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  s := src;

  s := replace(s, 'v_boat boolean := false; v_moor geography;',
                  'v_boat boolean := false; v_aib boolean := false; v_moor geography;');

  s := replace(s,
    '  v_boat := coalesce((select boat from vehicle_models where id = veh.model_id), false);'||E'\n'||
    '  if v_boat then v_comp := null; end if;',
    '  v_boat := coalesce((select boat from vehicle_models where id = veh.model_id), false);'||E'\n'||
    '  v_aib := coalesce((select aib from vehicle_models where id = veh.model_id), false);'||E'\n'||
    '  if v_boat then v_comp := null; end if;'||E'\n'||
    '  if m.venue = ''AIB'' and not v_aib then raise exception ''FIRE_NEEDS_AIB''; end if;'||E'\n'||
    '  if v_aib and m.venue is distinct from ''AIB'' then raise exception ''AIB_ONLY_FIRE''; end if;');

  s := replace(s,
    '    v_moor := coalesce(veh.moor_location, (select location from bases where id = veh.base_id));'||E'\n'||
    '    select * into v_port from ports order by st_distance(location, m.location) limit 1;'||E'\n'||
    '  end if;',
    '    v_moor := coalesce(veh.moor_location, (select location from bases where id = veh.base_id));'||E'\n'||
    '    select * into v_port from ports order by st_distance(location, m.location) limit 1;'||E'\n'||
    '  end if;'||E'\n'||
    '  if v_aib then'||E'\n'||
    '    if (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''aib'') < 1'||E'\n'||
    '       or exists (select 1 from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) not in (''aib'',''soccorritore_base'',''soccorritore_avanzato'')) then'||E'\n'||
    '      raise exception ''AIB_CREW''; end if;'||E'\n'||
    '  end if;');

  s := replace(s,
    '  if not v_am and not v_boat and not (m.requires <@ vehicle_provides(veh.equipment)) then',
    '  if not v_am and not v_boat and not v_aib and not (m.requires <@ vehicle_provides(veh.equipment)) then');

  s := replace(s, '  if not v_am and not v_boat then'||E'\n'||'  if n_autisti',
                  '  if not v_am and not v_boat and not v_aib then'||E'\n'||'  if n_autisti');

  s := replace(s,
    '  dist_km := st_distance(b.location, m.location) / 1000.0;',
    '  if v_aib then'||E'\n'||
    '    v_route := aib_fire_route(v_start, m.location, b.location, t0, m.event_ends_at, v_em);'||E'\n'||
    '    t1 := coalesce((v_route->1->>''t'')::timestamptz, t1);'||E'\n'||
    '    v_free := coalesce((v_route->-2->>''t'')::timestamptz, m.event_ends_at);'||E'\n'||
    '    t5 := ((v_route->-1)->>''t'')::timestamptz; h := null;'||E'\n'||
    '  end if;'||E'\n'||
    '  dist_km := st_distance(b.location, m.location) / 1000.0;');

  if s = src then raise exception 'claim_mission_as: nessuna patch AIB applicata'; end if;
  execute s;
end $$;

-- tick: aggiungi il task 'fires'
do $$
declare src text; s text;
begin
  src := pg_get_functiondef('public.game_tick'::regproc);
  s := replace(src, '(''sea'',120,16)) v(task, every, ord)', '(''sea'',120,16),(''fires'',60,17)) v(task, every, ord)');
  if s = src then raise exception 'game_tick: patch non applicata'; end if;
  execute s;
end $$;

do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.run_tick_task'::regproc), E'\r\n', E'\n');
  s := replace(src, '    when ''base_auctions'' then perform close_base_auctions();',
                    '    when ''base_auctions'' then perform close_base_auctions();'||E'\n'||'    when ''fires'' then perform tick_wildfires();');
  if s = src then raise exception 'run_tick_task: patch non applicata'; end if;
  execute s;
end $$;

-- accendi un incendio adesso (gravita' media)
select public.spawn_wildfire(2) as incendio_id;
