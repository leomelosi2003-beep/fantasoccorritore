-- Ingressi e uscite degli ospedali. Livorno: si entra da via Gramsci (Pronto Soccorso), si esce da via della Meridiana.
alter table hospitals add column if not exists entry_location geography(Point, 4326);
alter table hospitals add column if not exists exit_location geography(Point, 4326);

update hospitals set
  location       = st_setsrid(st_makepoint(10.3245380, 43.5500301), 4326)::geography,  -- Pronto Soccorso
  entry_location = st_setsrid(st_makepoint(10.3245000, 43.5490500), 4326)::geography,  -- cancello su via Gramsci
  exit_location  = st_setsrid(st_makepoint(10.3244500, 43.5512500), 4326)::geography   -- uscita su via della Meridiana
where name = 'Ospedale di Livorno';

-- Aggiunge al percorso il passaggio dall'ingresso (arrivo) e dall'uscita (partenza) degli ospedali
create or replace function hospital_gates(r jsonb) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare out jsonb := '[]'; i int; p jsonb; prev jsonb; nxt jsonb; h hospitals; pt geography; tt timestamptz;
begin
  for i in 0 .. jsonb_array_length(r) - 1 loop
    p := r->i; prev := r->(i - 1); nxt := r->(i + 1);
    pt := st_setsrid(st_makepoint((p->>'lng')::float8, (p->>'lat')::float8), 4326)::geography;
    select * into h from hospitals where entry_location is not null and st_dwithin(location, pt, 10) limit 1;
    tt := (p->>'t')::timestamptz;
    -- arrivo: prima passa dal cancello d'ingresso
    if h.id is not null and i > 0 and (prev->>'lat' <> p->>'lat' or prev->>'lng' <> p->>'lng') then
      out := out || jsonb_build_array(route_point(h.entry_location, tt - interval '45 seconds', p->>'label'));
    end if;
    out := out || jsonb_build_array(p);
    -- partenza: esce dall'uscita
    if h.id is not null and nxt is not null and (nxt->>'lat' <> p->>'lat' or nxt->>'lng' <> p->>'lng') then
      out := out || jsonb_build_array(route_point(h.exit_location, tt + interval '45 seconds', p->>'label'));
    end if;
    h := null;
  end loop;
  return out;
end $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('hospital_gates' in src) = 0 then
    src := replace(src, '  dist_km := st_distance(b.location, m.location) / 1000.0;',
                        '  v_route := hospital_gates(v_route);
  dist_km := st_distance(b.location, m.location) / 1000.0;');
    execute src;
  end if;
end $do$;

select position('hospital_gates' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as ok,
       hospital_gates(jsonb_build_array(
         route_point(st_setsrid(st_makepoint(10.31, 43.54), 4326)::geography, now(), 'Sul posto'),
         route_point((select location from hospitals where name = 'Ospedale di Livorno'), now() + interval '10 min', 'Ospedale di Livorno'),
         route_point((select location from hospitals where name = 'Ospedale di Livorno'), now() + interval '25 min', 'Ospedale di Livorno'),
         route_point(st_setsrid(st_makepoint(10.33, 43.56), 4326)::geography, now() + interval '35 min', 'Sede'))) as prova;
