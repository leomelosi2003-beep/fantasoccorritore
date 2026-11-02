-- Server alleggerito: tolti vehicles e mission_assignments dalla pubblicazione realtime (non usati), niente modalità
-- automatica annidata (trigger cards_ready_dispatch disattivato, resolve_races non la chiama più), pieno dalla cisterna
-- spostato a fine servizio (complete_due_assignments) invece che alla partenza. (vedi SQL applicato)
alter publication supabase_realtime drop table public.vehicles, public.mission_assignments;
