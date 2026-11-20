set search_path = public, extensions;
-- MAXI lontane: le ambulanze vanno all'aeroporto più vicino, salgono sul C-130H convenzionato dell'Aeronautica,
-- atterrano all'aeroporto più vicino alla maxi e da lì vanno sul posto (e al ritorno lo stesso). Solo se è più veloce della strada.
-- Nessun dato cancellato: tabella nuova, funzioni nuove, rotte dei mezzi già in viaggio ricalcolate.
create table if not exists airports (
  id serial primary key,
  name text unique not null,
  location geography(Point, 4326) not null
);
insert into airports (name, location)
select v.name, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography from (values
  ('Aeroporto di Pisa (46ª Brigata Aerea)', 43.6839, 10.3927), ('Aeroporto di Firenze Peretola', 43.8100, 11.2051),
  ('Aeroporto di Genova', 44.4133, 8.8375), ('Aeroporto di Milano Linate', 45.4451, 9.2767), ('Aeroporto di Milano Malpensa', 45.6301, 8.7231),
  ('Aeroporto di Bergamo Orio al Serio', 45.6739, 9.7042), ('Aeroporto di Brescia Montichiari', 45.4289, 10.3306),
  ('Aeroporto di Torino Caselle', 45.2008, 7.6496), ('Aeroporto di Cuneo Levaldigi', 44.5471, 7.6232),
  ('Aeroporto di Verona Villafranca', 45.3957, 10.8885), ('Aeroporto di Venezia Tessera', 45.5053, 12.3519), ('Aeroporto di Treviso', 45.6484, 12.1944),
  ('Aeroporto di Trieste', 45.8275, 13.4722), ('Aeroporto di Bolzano', 46.4602, 11.3264), ('Aeroporto di Bologna', 44.5354, 11.2887),
  ('Aeroporto di Parma', 44.8245, 10.2964), ('Aeroporto di Rimini', 44.0203, 12.6117), ('Aeroporto di Forlì', 44.1948, 12.0701),
  ('Aeroporto di Grosseto', 42.7597, 11.0719), ('Aeroporto di Perugia', 43.0959, 12.5132), ('Aeroporto di Ancona', 43.6163, 13.3623),
  ('Aeroporto di Pescara', 42.4317, 14.1811), ('Aeroporto di Roma Fiumicino', 41.8003, 12.2389), ('Aeroporto di Roma Ciampino', 41.7994, 12.5949),
  ('Aeroporto di Pratica di Mare', 41.6540, 12.4452), ('Aeroporto di Napoli Capodichino', 40.8860, 14.2908), ('Aeroporto di Salerno', 40.6204, 14.9113),
  ('Aeroporto di Foggia Amendola', 41.5414, 15.7181), ('Aeroporto di Bari Palese', 41.1389, 16.7606), ('Aeroporto di Gioia del Colle', 40.7678, 16.9333),
  ('Aeroporto di Taranto Grottaglie', 40.5175, 17.4032), ('Aeroporto di Brindisi', 40.6576, 17.9470), ('Aeroporto di Crotone', 38.9972, 17.0802),
  ('Aeroporto di Lamezia Terme', 38.9054, 16.2423), ('Aeroporto di Reggio Calabria', 38.0712, 15.6516), ('Aeroporto di Palermo', 38.1759, 13.0910),
  ('Aeroporto di Trapani Birgi', 37.9114, 12.4880), ('Aeroporto di Catania', 37.4668, 15.0664), ('Aeroporto di Comiso', 36.9946, 14.6072),
  ('Aeroporto di Cagliari', 39.2515, 9.0543), ('Aeroporto di Olbia', 40.8987, 9.5176), ('Aeroporto di Alghero', 40.6321, 8.2908)
) v(name, lat, lng)
on conflict (name) do nothing;
alter table airports enable row level security;
drop policy if exists airports_read on airports;
create policy airports_read on airports for select using (true);
grant select on airports to anon, authenticated;

-- un tratto in aereo (dal punto a al punto b), oppure null se non conviene
create or replace function public.airlift_leg(a geography, b geography, t timestamptz, p_vmax numeric, p_agi numeric, p_boost numeric,
                                              p_mode text, p_label text)
returns jsonb language plpgsql stable set search_path = public, extensions as $$
declare pa airports; pb airports; t_in timestamptz; t_off timestamptz; t_land timestamptz; t_out timestamptz; t_arr timestamptz; road timestamptz;
begin
  if st_distance(a, b) < 300000 then return null; end if;
  select * into pa from airports order by location <-> a limit 1;
  select * into pb from airports order by location <-> b limit 1;
  if pa.id is null or pb.id is null or pa.id = pb.id or st_distance(pa.location, pb.location) < 250000 then return null; end if;
  t_in := t + make_interval(secs => drive_seconds(a, pa.location, p_vmax, p_agi, p_mode, p_boost));
  t_off := t_in + interval '40 minutes';                                            -- carico dei mezzi nella stiva
  t_land := t_off + make_interval(secs => st_distance(pa.location, pb.location) / 1000.0 / 500.0 * 3600 + 20 * 60);   -- C-130H ~500 km/h
  t_out := t_land + interval '20 minutes';                                          -- scarico
  t_arr := t_out + make_interval(secs => drive_seconds(pb.location, b, p_vmax, p_agi, p_mode, p_boost));
  road := t + make_interval(secs => drive_seconds(a, b, p_vmax, p_agi, p_mode, p_boost));
  if t_arr >= road then return null; end if;
  return jsonb_build_array(
    route_point(pa.location, t_in, '✈️ Imbarco C-130: ' || pa.name),
    route_point(pa.location, t_off, '✈️ Imbarco C-130: ' || pa.name),
    route_point(pb.location, t_land, '✈️ Sbarco: ' || pb.name),
    route_point(pb.location, t_out, '✈️ Sbarco: ' || pb.name),
    route_point(b, t_arr, p_label));
end $$;

-- corregge un percorso: i tratti lunghi passano dall'aereo; gli orari dopo si spostano (anche in anticipo).
-- p_stay_until: la sosta sul posto dura almeno fin lì (fine della maxi)
create or replace function public.airlift_fix(r jsonb, p_vmax numeric, p_agi numeric, p_boost numeric, p_mode text, p_stay_until timestamptz)
returns jsonb language plpgsql stable set search_path = public, extensions as $$
declare out jsonb; i int; p jsonb; q jsonb; pa geography; pb geography; seg jsonb; shift interval := '0'; nt timestamptz; last_t timestamptz; moved int := 0;
begin
  if r is null or jsonb_array_length(r) < 2 then return r; end if;
  out := jsonb_build_array(r->0);
  for i in 1 .. jsonb_array_length(r) - 1 loop
    p := r->(i - 1); q := r->i;
    last_t := (out->-1->>'t')::timestamptz;
    if p->>'lat' = q->>'lat' and p->>'lng' = q->>'lng' then          -- sosta sul posto
      nt := greatest(last_t, coalesce(p_stay_until, (q->>'t')::timestamptz + shift));
      shift := nt - (q->>'t')::timestamptz;
      out := out || jsonb_build_array(jsonb_set(q, '{t}', to_jsonb(nt)));
      continue;
    end if;
    moved := moved + 1;
    pa := st_setsrid(st_makepoint((p->>'lng')::float8, (p->>'lat')::float8), 4326)::geography;
    pb := st_setsrid(st_makepoint((q->>'lng')::float8, (q->>'lat')::float8), 4326)::geography;
    seg := airlift_leg(pa, pb, last_t, p_vmax, p_agi, p_boost, case when moved = 1 then p_mode else 'rientro' end, coalesce(q->>'label', 'Sul posto'));
    if seg is not null then
      out := out || seg;
      shift := (seg->-1->>'t')::timestamptz - (q->>'t')::timestamptz;
      continue;
    end if;
    out := out || jsonb_build_array(jsonb_set(q, '{t}', to_jsonb(greatest(last_t, (q->>'t')::timestamptz + shift))));
  end loop;
  return out;
end $$;

-- claim: per le maxi, dopo i traghetti, si prova l'aereo
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position('airlift_fix' in src) > 0 then return; end if;
  n := replace(src, '  v_route := hospital_gates(v_route);
', '  v_route := hospital_gates(v_route);
  -- maxi lontane: C-130H dell''Aeronautica tra l''aeroporto più vicino alla sede e quello più vicino alla maxi
  if not v_boat and m.category = ''grande_evento'' and m.event_id is null and coalesce(m.venue, '''') not in (''AIB'', ''PC'') then
    declare r0 jsonb := v_route;
    begin
      v_route := airlift_fix(v_route, v_vmax, v_agi, v_boost, m.code::text, m.event_ends_at);
      if v_route::text <> r0::text then
        t1 := coalesce((select (x->>''t'')::timestamptz from jsonb_array_elements(v_route) with ordinality q(x, i)
                         where i > 1 and x->>''label'' = ''Sul posto'' order by i limit 1), t1);
        t5 := coalesce((v_route->-1->>''t'')::timestamptz, t5);
      end if;
    end;
  end if;
');
  if n = src then raise exception 'claim: hospital_gates non trovato'; end if;
  execute n;
end $d$;

-- mezzi GIÀ in viaggio verso una maxi lontana: si ricalcola il viaggio da dove sono adesso
do $d$
declare a record; m record; pos geography; nr jsonb; rest jsonb; vm record; boost numeric; t_arr timestamptz; k int := 0;
begin
  for a in
    select ma.*, v.model_id, v.speed_level, v.base_id vb from mission_assignments ma join vehicles v on v.id = ma.vehicle_id
      join missions mi on mi.id = ma.mission_id
     where mi.category = 'grande_evento' and mi.event_id is null and coalesce(mi.venue, '') not in ('AIB', 'PC')
       and mi.status in ('aperta', 'completa', 'in_corso') and ma.status = 'in_viaggio' and ma.arrives_at > now() + interval '45 minutes'
       and ma.route::text not like '%C-130%'
  loop
    select * into m from missions where id = a.mission_id;
    select * into vm from vehicle_models where id = a.model_id;
    if coalesce(vm.boat, false) then continue; end if;
    boost := 1 + 0.12 * coalesce(a.speed_level, 0);
    pos := vehicle_position(a.vehicle_id, m.location);
    select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into rest from jsonb_array_elements(a.route) with ordinality q(x, i)
     where (x->>'t')::timestamptz > now();
    if jsonb_array_length(rest) < 1 then continue; end if;
    nr := airlift_fix(jsonb_build_array(route_point(pos, now(), 'Partenza')) || rest,
                      coalesce(vm.vmax_kmh, 130), coalesce(vm.agility, 1), boost, m.code::text, m.event_ends_at);
    if nr::text like '%C-130%' then
      t_arr := (select (x->>'t')::timestamptz from jsonb_array_elements(nr) with ordinality q(x, i) where i > 1 and x->>'label' = 'Sul posto' order by i limit 1);
      execute 'up'||'date mission_assignments set route = $1, arrives_at = coalesce($2, arrives_at), completes_at = coalesce(($1->-2->>''t'')::timestamptz, completes_at) where id = $3'
        using nr, t_arr, a.id;
      k := k + 1;
    end if;
  end loop;
  raise notice 'ESITO mezzi in viaggio messi sull''aereo: %', k;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO aereo', (select count(*) from airports), position('airlift_fix' in pg_get_functiondef('public.claim_mission_as'::regproc)) > 0;
select 'ESITO prova Firenze-Bari', r->1->>'label', r->-1->>'t', (r->-1->>'t')::timestamptz - now()
  from (select airlift_leg(st_setsrid(st_makepoint(11.25, 43.77), 4326)::geography, st_setsrid(st_makepoint(16.85, 41.10), 4326)::geography,
                           now(), 130, 1, 1, 'rosso', 'Sul posto') r) x;
