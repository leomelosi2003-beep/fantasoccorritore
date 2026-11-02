-- Giocatori online: organizations.last_seen_at aggiornato da rpc heartbeat() ogni 60 s;
-- bases_map ha le colonne online (visto negli ultimi 2 minuti) e last_seen_at. (vedi SQL applicato)
alter table organizations add column if not exists last_seen_at timestamptz;
create or replace function public.heartbeat() returns void
language sql security definer set search_path = public as $$
  update organizations set last_seen_at = now() where owner_id = auth.uid();
$$;
