set search_path = public, extensions;
-- Porto di Genova (terminal traghetti) e Porto Torres, con le linee per Sardegna e Sicilia
insert into ports (name, location, island, can_unload)
select v.name, st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography, v.island, false
from (values ('Porto di Genova (Terminal Traghetti)', 44.4090, 8.9050, null::text),
             ('Porto di Porto Torres', 40.8390, 8.4030, 'Sardegna')) v(name, lat, lng, island)
where not exists (select 1 from ports p where p.name = v.name);

do $$
declare pid jsonb := (select jsonb_object_agg(name, id) from ports); g int; begin
  g := (pid->>'Porto di Genova (Terminal Traghetti)')::int;
  if exists (select 1 from ferry_lines where from_port = g or to_port = g) then return; end if;
  insert into ferry_lines (from_port, to_port, company, minutes, departures, via) values
    (g, (pid->>'Porto di Olbia (Isola Bianca)')::int, 'Moby / Tirrenia', 600, '{1230}', '[[9.95,43.6],[10.0,43.2],[9.85,42.5],[9.75,41.5],[9.65,41.0]]'),
    ((pid->>'Porto di Olbia (Isola Bianca)')::int, g, 'Moby / Tirrenia', 600, '{1200}', '[[9.65,41.0],[9.75,41.5],[9.85,42.5],[10.0,43.2],[9.95,43.6]]'),
    (g, (pid->>'Porto di Porto Torres')::int, 'Tirrenia / GNV', 660, '{1200}', '[[8.6,43.6],[8.3,42.0],[8.4,41.1]]'),
    ((pid->>'Porto di Porto Torres')::int, g, 'Tirrenia / GNV', 660, '{1230}', '[[8.4,41.1],[8.3,42.0],[8.6,43.6]]'),
    (g, (pid->>'Porto di Palermo')::int, 'GNV', 1200, '{1260}', '[[9.95,43.6],[10.0,43.2],[9.95,42.5],[10.5,40.0],[12.5,38.6]]'),
    ((pid->>'Porto di Palermo')::int, g, 'GNV', 1200, '{1380}', '[[12.5,38.6],[10.5,40.0],[9.95,42.5],[10.0,43.2],[9.95,43.6]]');
end $$;
select 'ESITO genova', p.name, count(fl.*) from ports p left join ferry_lines fl on fl.from_port = p.id
 where p.name like 'Porto di Genova%' or p.name = 'Porto di Porto Torres' group by p.name;
