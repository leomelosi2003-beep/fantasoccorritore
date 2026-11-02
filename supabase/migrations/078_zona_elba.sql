-- ZONA ELBA + OSPEDALE DI PORTOFERRAIO
-- Servizi anche su tutta l'Isola d'Elba (7 comuni): 2.252 punti strada di OpenStreetMap,
-- etichettati con la località elbana più vicina (96 località, aggiunte a mission_localities_cache
-- così entrano nel 50% di servizi "sparsi" con la stessa probabilità delle altre).
-- I nomi già usati sul continente prendono il suffisso " (Elba)" (Marciana, Acquabona).

-- Scaricamento (una volta sola, riquadro dell'isola), poi lettura con net._http_response:
--   select net.http_get('https://lz4.overpass-api.de/api/interpreter?data=' || <urlencode>('
--   [out:json][timeout:120][bbox:42.70,10.08,42.90,10.45];
--   (way["highway"~"^(residential|tertiary|secondary|unclassified|living_street)$"];
--    node["place"~"^(town|village|suburb|quarter|hamlet)$"];
--    nwr["amenity"="hospital"];);
--   out center;'), timeout_milliseconds => 170000);
-- poi (x = elementi della risposta):
--   insert into osm_places  (nodi place, nome con " (Elba)" se già presente in mission_localities_cache)
--   insert into osm_roads   (centri delle strade)
--   insert into mission_spots (comune, location)
--     select p.name, r.g::geography from elba_roads r
--     cross join lateral (select name from elba_places ep order by ep.g <-> r.g limit 1) p;
--   insert into mission_localities_cache (le nuove località elbane)

-- Ospedale Civile Elbano, Portoferraio (coordinate OpenStreetMap)
insert into hospitals (name, location, capabilities, region, specialty, transfer_dest)
values ('Ospedale di Portoferraio (Elba)', st_setsrid(st_makepoint(10.3197240, 42.8158783), 4326)::geography,
        '{ps,cardio,pediatria,dialisi}', 'Toscana', null, false)
on conflict (name) do nothing;
