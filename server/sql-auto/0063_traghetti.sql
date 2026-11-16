-- TRAGHETTI: linee con orari fissi tra porti. Le ambulanze (e i mezzi maxi) li usano da sole per attraversare il mare
-- nelle missioni di protezione civile / maxi / incendi / grandi eventi e nei trasferimenti tra ospedali.
-- Nessun dato esistente toccato: solo porti nuovi, tabella nuova e funzioni.

-- 1) porti nuovi (Sardegna, Giglio, Stretto di Messina, golfo di Napoli, Palermo)
insert into ports (name, location, island, can_unload)
select v.name, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, v.island, v.cu
from (values
  ('Porto di Olbia (Isola Bianca)', 40.9230, 9.5160, 'Sardegna', false),
  ('Porto di Cagliari', 39.2110, 9.1100, 'Sardegna', false),
  ('Giglio Porto', 42.3600, 10.9220, 'Giglio', false),
  ('Porto di Villa San Giovanni', 38.2190, 15.6340, null, false),
  ('Porto di Messina', 38.2050, 15.5640, 'Sicilia', false),
  ('Porto di Napoli (Molo Beverello)', 40.8370, 14.2550, null, false),
  ('Porto di Ischia', 40.7460, 13.9440, 'Ischia', false),
  ('Procida Marina Grande', 40.7640, 14.0300, 'Procida', false),
  ('Capri Marina Grande', 40.5560, 14.2370, 'Capri', false),
  ('Porto di Palermo', 38.1260, 13.3650, 'Sicilia', false)
) v(name, lat, lng, island, cu)
where not exists (select 1 from ports p where p.name = v.name);

-- 2) linee
create table if not exists ferry_lines (
  id serial primary key,
  from_port int not null references ports(id),
  to_port int not null references ports(id),
  company text not null,
  minutes int not null,                 -- durata della traversata
  departures int[] not null,            -- partenze: minuti dalla mezzanotte (ora italiana)
  via jsonb                             -- punti in mare [[lng,lat],...] per non passare sulla terra
);
alter table ferry_lines enable row level security;
drop policy if exists ferry_lines_read on ferry_lines;
create policy ferry_lines_read on ferry_lines for select using (true);
grant select on ferry_lines to anon, authenticated;

do $$
declare
  pid jsonb := (select jsonb_object_agg(name, id) from ports);
begin
  if exists (select 1 from ferry_lines) then return; end if;
  insert into ferry_lines (from_port, to_port, company, minutes, departures, via) values
    -- Piombino ⇄ Elba (Portoferraio): ogni ora
    ((pid->>'Porto di Piombino')::int, (pid->>'Porto di Portoferraio')::int, 'Toremar / Moby', 60, array(select generate_series(360, 1320, 60)), null),
    ((pid->>'Porto di Portoferraio')::int, (pid->>'Porto di Piombino')::int, 'Toremar / Moby', 60, array(select generate_series(390, 1350, 60)), null),
    -- Livorno ⇄ Capraia
    ((pid->>'Porto di Livorno')::int, (pid->>'Porto di Capraia')::int, 'Toremar', 165, '{510,990}', null),
    ((pid->>'Porto di Capraia')::int, (pid->>'Porto di Livorno')::int, 'Toremar', 165, '{705,1185}', null),
    -- Livorno ⇄ Olbia
    ((pid->>'Porto di Livorno')::int, (pid->>'Porto di Olbia (Isola Bianca)')::int, 'Moby', 540, '{480,1320}', '[[10.0,42.6],[9.75,41.5],[9.65,41.0]]'),
    ((pid->>'Porto di Olbia (Isola Bianca)')::int, (pid->>'Porto di Livorno')::int, 'Moby', 540, '{510,1290}', '[[9.65,41.0],[9.75,41.5],[10.0,42.6]]'),
    -- Livorno ⇄ Cagliari
    ((pid->>'Porto di Livorno')::int, (pid->>'Porto di Cagliari')::int, 'Tirrenia', 960, '{1080}', '[[10.0,42.6],[9.95,41.2],[9.85,40.0],[9.62,39.05],[9.25,39.15]]'),
    ((pid->>'Porto di Cagliari')::int, (pid->>'Porto di Livorno')::int, 'Tirrenia', 960, '{1020}', '[[9.25,39.15],[9.62,39.05],[9.85,40.0],[9.95,41.2],[10.0,42.6]]'),
    -- Porto Santo Stefano ⇄ Giglio
    ((pid->>'Porto Santo Stefano')::int, (pid->>'Giglio Porto')::int, 'Toremar / Maregiglio', 60, '{420,570,720,900,1080}', null),
    ((pid->>'Giglio Porto')::int, (pid->>'Porto Santo Stefano')::int, 'Toremar / Maregiglio', 60, '{360,480,630,810,990,1140}', null),
    -- Stretto di Messina
    ((pid->>'Porto di Villa San Giovanni')::int, (pid->>'Porto di Messina')::int, 'Caronte & Tourist', 30, array(select generate_series(300, 1380, 40)), null),
    ((pid->>'Porto di Messina')::int, (pid->>'Porto di Villa San Giovanni')::int, 'Caronte & Tourist', 30, array(select generate_series(320, 1400, 40)), null),
    -- Golfo di Napoli
    ((pid->>'Porto di Napoli (Molo Beverello)')::int, (pid->>'Porto di Ischia')::int, 'Caremar / Medmar', 90, '{480,660,840,1050}', null),
    ((pid->>'Porto di Ischia')::int, (pid->>'Porto di Napoli (Molo Beverello)')::int, 'Caremar / Medmar', 90, '{390,570,780,960,1140}', null),
    ((pid->>'Porto di Napoli (Molo Beverello)')::int, (pid->>'Procida Marina Grande')::int, 'Caremar', 60, '{510,750,990}', null),
    ((pid->>'Procida Marina Grande')::int, (pid->>'Porto di Napoli (Molo Beverello)')::int, 'Caremar', 60, '{420,660,900,1140}', null),
    ((pid->>'Porto di Napoli (Molo Beverello)')::int, (pid->>'Capri Marina Grande')::int, 'Caremar', 50, '{450,600,780,960}', null),
    ((pid->>'Capri Marina Grande')::int, (pid->>'Porto di Napoli (Molo Beverello)')::int, 'Caremar', 50, '{525,690,870,1050,1170}', null),
    -- Napoli ⇄ Palermo (notte)
    ((pid->>'Porto di Napoli (Molo Beverello)')::int, (pid->>'Porto di Palermo')::int, 'Tirrenia / GNV', 630, '{1200}', '[[14.15,40.55],[13.6,39.0]]'),
    ((pid->>'Porto di Palermo')::int, (pid->>'Porto di Napoli (Molo Beverello)')::int, 'Tirrenia / GNV', 630, '{1200}', '[[13.6,39.0],[14.15,40.55]]');
end $$;

-- 3) prossima partenza di una linea dopo un certo momento (orari in ora italiana)
create or replace function public.ferry_next_departure(p_line int, p_after timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select min(ts) from (
    select ((((p_after at time zone 'Europe/Rome')::date + k)::timestamp + make_interval(mins => d)) at time zone 'Europe/Rome') ts
    from ferry_lines fl, unnest(fl.departures) d, generate_series(0, 2) k
    where fl.id = p_line) x
  where ts >= p_after
$$;

-- due isole (o isola e continente) collegate da traghetti, anche passando dal continente
create or replace function public.ferry_connected(ia text, ib text)
returns boolean language sql stable set search_path = public as $$
  select ia is not distinct from ib or (
    (ia is null or exists (select 1 from ferry_lines fl join ports pf on pf.id = fl.from_port join ports pt on pt.id = fl.to_port
                            where island_of(pf.location) = ia and island_of(pt.location) is null))
    and (ib is null or exists (select 1 from ferry_lines fl join ports pf on pf.id = fl.from_port join ports pt on pt.id = fl.to_port
                               where island_of(pf.location) is null and island_of(pt.location) = ib)))
$$;

-- 4) tratto con traghetto da a (all'ora t) fino a b: punti del percorso da accodare (senza a), l'ultimo è b
create or replace function public.ferry_cross(a geography, b geography, t timestamptz, p_vmax numeric, p_agi numeric, p_boost numeric,
                                              p_label text, p_depth int default 0)
returns jsonb language plpgsql stable set search_path = public, extensions as $$
declare ia text := island_of(a); ib text := island_of(b); want text; l record; t_port timestamptz; dep timestamptz;
        arr timestamptz; score timestamptz; path geography[]; out jsonb; km float8; i int; rest jsonb; pf ports; pt ports;
        b_id int; b_fp int; b_tp int; b_mins int; b_via jsonb; b_tport timestamptz; b_dep timestamptz; b_arr timestamptz; b_score timestamptz;
begin
  if ia is not distinct from ib or p_depth > 2 then
    return jsonb_build_array(route_point(b, t + make_interval(secs => drive_seconds(a, b, p_vmax, p_agi, 'rientro', p_boost)), p_label));
  end if;
  -- da un'isola a un'altra isola si passa dal continente
  want := case when ia is not null and ib is not null then null else ib end;
  for l in select fl.*, pf0.location pfl, pt0.location ptl from ferry_lines fl
             join ports pf0 on pf0.id = fl.from_port join ports pt0 on pt0.id = fl.to_port
            where island_of(pf0.location) is not distinct from ia and island_of(pt0.location) is not distinct from want loop
    t_port := t + make_interval(secs => drive_seconds(a, l.pfl, p_vmax, p_agi, 'rientro', p_boost));
    dep := ferry_next_departure(l.id, t_port + interval '15 minutes');
    continue when dep is null;
    arr := dep + make_interval(mins => l.minutes);
    score := arr + make_interval(secs => case when want is not distinct from ib then drive_seconds(l.ptl, b, p_vmax, p_agi, 'rientro', p_boost) else 0 end);
    if b_id is null or score < b_score then
      b_id := l.id; b_fp := l.from_port; b_tp := l.to_port; b_mins := l.minutes; b_via := l.via; b_tport := t_port; b_dep := dep; b_arr := arr; b_score := score;
    end if;
  end loop;
  if b_id is null then return null; end if;
  select * into pf from ports where id = b_fp;
  select * into pt from ports where id = b_tp;
  -- rotta della nave
  if b_via is not null then
    path := array[pf.location];
    for i in 0 .. jsonb_array_length(b_via) - 1 loop
      path := path || st_setsrid(st_makepoint((b_via->i->>0)::float8, (b_via->i->>1)::float8), 4326)::geography;
    end loop;
    path := path || pt.location;
  else
    path := sea_path(pf.location, pt.location);
  end if;
  km := 0; for i in 2 .. cardinality(path) loop km := km + st_distance(path[i - 1], path[i]) / 1000.0; end loop;
  out := jsonb_build_array(route_point(pf.location, b_tport, '⛴ Imbarco: ' || pf.name),
                           route_point(pf.location, b_dep, '⛴ Imbarco: ' || pf.name))
      || sea_route_points(path, b_dep, (b_mins * 60.0 / greatest(km, 0.1))::numeric, '⛴ Sbarco: ' || pt.name, b_mins * 60)
      || jsonb_build_array(route_point(pt.location, b_arr + interval '10 minutes', '⛴ Sbarco: ' || pt.name));
  rest := ferry_cross(pt.location, b, b_arr + interval '10 minutes', p_vmax, p_agi, p_boost, p_label, p_depth + 1);
  if rest is null then return null; end if;
  return out || rest;
end $$;

-- 5) corregge un percorso già calcolato: ogni tratto che attraversa il mare passa dal traghetto; gli orari dopo slittano
--    (le soste sul posto assorbono il ritardo: si riparte al più presto all'ora prevista)
create or replace function public.ferry_fix(r jsonb, p_vmax numeric, p_agi numeric, p_boost numeric)
returns jsonb language plpgsql stable set search_path = public, extensions as $$
declare out jsonb; i int; p jsonb; q jsonb; pa geography; pb geography; seg jsonb; shift interval := '0'; nt timestamptz; last_t timestamptz;
begin
  if r is null or jsonb_array_length(r) < 2 then return r; end if;
  out := jsonb_build_array(r->0);
  for i in 1 .. jsonb_array_length(r) - 1 loop
    p := r->(i - 1); q := r->i;
    last_t := (out->-1->>'t')::timestamptz;
    if p->>'lat' = q->>'lat' and p->>'lng' = q->>'lng' then          -- sosta: assorbe il ritardo
      nt := greatest((q->>'t')::timestamptz, last_t);
      shift := nt - (q->>'t')::timestamptz;
      out := out || jsonb_build_array(jsonb_set(q, '{t}', to_jsonb(nt)));
      continue;
    end if;
    pa := st_setsrid(st_makepoint((p->>'lng')::float8, (p->>'lat')::float8), 4326)::geography;
    pb := st_setsrid(st_makepoint((q->>'lng')::float8, (q->>'lat')::float8), 4326)::geography;
    if island_of(pa) is distinct from island_of(pb) then
      seg := ferry_cross(pa, pb, last_t, p_vmax, p_agi, p_boost, q->>'label');
      if seg is not null then
        out := out || seg;
        shift := (seg->-1->>'t')::timestamptz - (q->>'t')::timestamptz;
        continue;
      end if;
    end if;
    out := out || jsonb_build_array(jsonb_set(q, '{t}', to_jsonb((q->>'t')::timestamptz + shift)));
  end loop;
  return out;
end $$;

-- 6) claim: missioni oltre il mare possibili col traghetto (protezione civile, maxi, incendi, grandi eventi, trasferimenti)
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position('ferry_fix' in src) > 0 then return; end if;
  n := replace(src, '  if not v_boat and not (m.category = ''grande_evento'' and m.event_id is null)
     and island_of(b.location) is distinct from island_of(m.location) then raise exception ''ISLAND''; end if;',
                    '  if not v_boat and island_of(b.location) is distinct from island_of(m.location)
     and not ((m.category = ''grande_evento'' or coalesce(m.transport::text, '''') = ''trasferimento'')
              and ferry_connected(island_of(b.location), island_of(m.location))) then raise exception ''ISLAND''; end if;');
  if n = src then raise exception 'claim: controllo isole non trovato'; end if;
  src := n;
  n := replace(src, '  v_route := hospital_gates(v_route);
',
                    '  v_route := hospital_gates(v_route);
  -- traghetti: i tratti che attraversano il mare passano dal porto con gli orari delle navi
  if not v_boat and (m.category = ''grande_evento'' or coalesce(m.transport::text, '''') = ''trasferimento'') then
    declare r0 jsonb := v_route;
    begin
      v_route := ferry_fix(v_route, v_vmax, v_agi, v_boost);
      if v_route::text <> r0::text then
        t1 := coalesce((select (x->>''t'')::timestamptz from jsonb_array_elements(v_route) with ordinality q(x, i)
                         where i > 1 and x->>''lat'' = r0->1->>''lat'' and x->>''lng'' = r0->1->>''lng'' order by i limit 1), t1);
        t5 := coalesce((v_route->-1->>''t'')::timestamptz, t5);
      end if;
    end;
  end if;
');
  if n = src then raise exception 'claim: hospital_gates non trovato'; end if;
  execute n;
end $d$;

-- 7) orari per il popup del porto: prossime partenze (24 ore)
create or replace function public.port_ferries(p_port int)
returns table (to_name text, company text, departs_at timestamptz, arrives_at timestamptz, minutes int)
language sql stable security definer set search_path = public as $$
  select pt.name, fl.company, ts, ts + make_interval(mins => fl.minutes), fl.minutes
  from ferry_lines fl join ports pt on pt.id = fl.to_port,
       lateral (select ((((now() at time zone 'Europe/Rome')::date + k)::timestamp + make_interval(mins => d)) at time zone 'Europe/Rome') ts
                  from unnest(fl.departures) d, generate_series(0, 1) k) x
  where fl.from_port = p_port and ts between now() and now() + interval '24 hours'
  order by ts limit 12
$$;
grant execute on function public.port_ferries(int) to anon, authenticated;
notify pgrst, 'reload schema';

select 'ESITO traghetti', (select count(*) from ferry_lines), ferry_connected('elba', null), ferry_connected('capraia', 'elba'), ferry_connected('sardegna', null),
       position('ferry_fix' in pg_get_functiondef('public.claim_mission_as'::regproc)) > 0;
-- prova: da Livorno a Portoferraio
select 'ESITO prova', jsonb_array_length(r), r->0->>'label', r->-1->>'label', (r->-1->>'t')::timestamptz - now()
from (select ferry_cross(st_setsrid(st_makepoint(10.31, 43.55), 4326)::geography, st_setsrid(st_makepoint(10.33, 42.81), 4326)::geography,
                         now(), 150, 1, 1, 'Sul posto') r) x;
