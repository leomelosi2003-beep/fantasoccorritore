-- Meno carico sul database: niente più realtime su missions/bases (la mappa fa polling ogni 12 s, solo se la pagina è visibile),
-- cron: complete-assignments e auto-dispatch ogni 20 s, resolve-races ogni 10 s, wake-rested ogni 30 s.
alter publication supabase_realtime drop table public.missions, public.bases;
