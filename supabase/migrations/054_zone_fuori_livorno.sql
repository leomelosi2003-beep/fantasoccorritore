-- 4 servizi su 10 nascono in zone fuori Livorno (Collesalvetti, Vicarello, Stagno, Nugola, Guasticce, Castell'Anselmo,
-- Cenaia, Crespina, Lorenzana, Fauglia, Orciano Pisano, Parrana, Torretta Vecchia, Coltano, Pisa, Ospedaletto,
-- San Piero a Grado, Marina di Pisa, Tirrenia, Calambrone, Mortaiolo): ogni paese ha la stessa probabilità.
-- Il resto: 75% vicino a una sede, altrimenti ovunque. Distanza massima dalla sede per prendere un servizio: 25 km.
-- (applicato con patch su generate_missions() e claim_mission(); vedi SQL eseguito)
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := replace(src, 'st_dwithin(b.location, m.location, 15000)', 'st_dwithin(b.location, m.location, 25000)');
  execute src;
end $do$;
