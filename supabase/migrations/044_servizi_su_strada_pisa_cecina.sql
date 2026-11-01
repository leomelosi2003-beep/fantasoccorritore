-- SERVIZI SOLO SULLE STRADE (mai in mare) e in tutta la zona Livorno–Pisa–Cecina.
-- I punti sono i centri delle strade di OpenStreetMap (Overpass) di 19 comuni,
-- etichettati con la località più vicina (quartiere/frazione).
create table if not exists mission_spots (id bigserial primary key, comune text not null, location geography(Point, 4326) not null);
alter table mission_spots enable row level security;
create table if not exists osm_places (name text, g geometry(Point, 4326));
create table if not exists osm_roads (g geometry(Point, 4326));
alter table osm_places enable row level security;
alter table osm_roads enable row level security;
create index if not exists osm_places_g on osm_places using gist (g);

-- Scaricamento (una volta sola), poi lettura della risposta con net._http_response:
--   select net.http_get('https://overpass.private.coffee/api/interpreter?data=' || urlencode_simple('
--   [out:json][timeout:180];
--   area["name"~"^(Livorno|Collesalvetti|Rosignano Marittimo|Pisa|San Giuliano Terme|Cascina|Vecchiano|Calci|Vicopisano|Fauglia|Crespina Lorenzana|Orciano Pisano|Santa Luce|Cecina|Bibbona|Montescudaio|Guardistallo|Riparbella|Castellina Marittima)$"]["admin_level"="8"]->.a;
--   (way(area.a)["highway"~"^(residential|tertiary|secondary|unclassified|living_street)$"];
--    node(area.a)["place"~"^(city|town|village|suburb|quarter|hamlet)$"];);
--   out center;'), timeout_milliseconds => 170000);
-- poi: insert in osm_places (nodi place) e osm_roads (centri delle strade), e
--   insert into mission_spots (comune, location)
--   select p.name, r.g::geography from osm_roads r
--   cross join lateral (select name from osm_places op order by op.g <-> r.g limit 1) p;

-- Il generatore pesca un punto a caso tra le strade (niente più spostamento casuale che finiva in mare)
do $do$
declare src text;
begin
  src := pg_get_functiondef('generate_missions()'::regprocedure);
  src := regexp_replace(src, 'select \* into z from \(values.*?order by random\(\) limit 1;',
    'select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
      from mission_spots offset floor(random() * (select count(*) from mission_spots)) limit 1;');
  src := replace(src, 'z.lng + (random() - 0.5) * 0.027', 'z.lng');
  src := replace(src, 'z.lat + (random() - 0.5) * 0.027', 'z.lat');
  src := replace(src, 'to_create := least(3, 25 - open_count);', 'to_create := least(4, 40 - open_count);');
  execute src;
end $do$;
