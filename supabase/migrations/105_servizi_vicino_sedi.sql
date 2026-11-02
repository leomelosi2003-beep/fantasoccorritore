-- generate_missions: 20% dei servizi nascono entro 40 km da una sede a caso (anche quelle create in futuro).
-- Ripartizione: 22% Pisa, 22% Livorno, 20% vicino a una sede, 16% zona, 20% Toscana. Indici gist sui punti. (vedi SQL applicato)
create index if not exists mission_spots_loc on mission_spots using gist (location);
create index if not exists mission_spots_toscana_loc on mission_spots_toscana using gist (location);
