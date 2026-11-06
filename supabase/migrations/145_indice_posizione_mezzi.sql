-- Velocità: vehicle_position() cercava l'ultimo percorso del mezzo leggendo tutta mission_assignments
-- (nessun indice su vehicle_id): ~19 ms a chiamata, centinaia di chiamate a ogni giro del motore
-- (auto_dispatch_org, auto_medical, live_ambulances). Con questo indice la ricerca è diretta.
-- Nessuna modifica alle regole del gioco.
create index if not exists mission_assignments_vehicle_route_idx
  on public.mission_assignments (vehicle_id, assigned_at desc)
  where route is not null;

-- usato anche dai controlli "il mezzo è ancora in giro?" (officina automatica, prestiti, flotta)
create index if not exists mission_assignments_vehicle_idx
  on public.mission_assignments (vehicle_id);

analyze public.mission_assignments;
