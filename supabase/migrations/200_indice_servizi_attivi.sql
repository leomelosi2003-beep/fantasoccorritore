-- 200 (12/11/2026): tick bloccato fino a 120 s (statement timeout) e invii dei giocatori annullati dopo 8 s.
-- Causa: auto_medical/auto_dispatch cercano i servizi vicini con st_dwithin e il planner usava missions_location_idx
-- (gist su TUTTI i ~200.000 servizi storici), filtrando migliaia di righe per ogni mezzo. Soluzione: indice gist parziale
-- sui soli servizi attivi (~200 righe).
create index if not exists missions_active_location_idx on public.missions using gist (location) where status in ('aperta', 'completa', 'in_corso');
analyze public.missions;
