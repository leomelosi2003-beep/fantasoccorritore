-- Servizi sparsi su tutta la zona: 25% Pisa (7 km dal centro), 25% Livorno (7 km), 50% su tutte le 272 località
-- con la stessa probabilità ciascuna (paesi e frazioni da Pisa a Cecina), per invogliare sedi fuori città.
create table if not exists mission_localities_cache as select distinct comune from mission_spots;
alter table mission_localities_cache enable row level security;
-- (patch del blocco di scelta della posizione in generate_missions(); vedi SQL applicato)
