-- 201 (12/11/2026 sera): tick ancora a 67-83 s e invii dei giocatori in timeout.
-- 1) game_tick registra in public.tick_log (task, ms) ogni fase >= 1,5 s (tenuti 3 giorni): per capire subito cosa rallenta.
-- 2) Causa: tick_wildfires faceva ogni minuto "max(created_at) from missions where venue='AIB'" = lettura completa di ~200.000
--    servizi (14-21 s, e svuotava la cache rallentando tutto il resto). Ora: due EXISTS con indici parziali
--    missions_aib_created_idx (created_at desc) where venue='AIB' and category='grande_evento'
--    missions_ge_active_idx (status) where category='grande_evento' and status in (aperta, completa, in_corso).  -> 1,4 ms.
create table if not exists public.tick_log (at timestamptz not null default now(), task text not null, ms int not null);
create index if not exists tick_log_at_idx on public.tick_log (at desc);
alter table public.tick_log enable row level security;
create index if not exists missions_aib_created_idx on public.missions (created_at desc) where venue = 'AIB' and category = 'grande_evento';
create index if not exists missions_ge_active_idx on public.missions (status) where category = 'grande_evento' and status in ('aperta','completa','in_corso');
-- (game_tick e tick_wildfires riscritte via MCP: vedi pg_get_functiondef)
