-- 195 (11/11/2026): dopo il ritorno su Supabase cloud (piano Free, CPU piccola) alcune letture erano lentissime.
-- 1) live_ambulances (mezzi degli altri sulla mappa) leggeva TUTTE le assegnazioni mai fatte (19 s, timeout per anon):
--    funzione immutabile + indice sulla fine del percorso.
create or replace function public.fs_route_end(r jsonb, c timestamptz) returns timestamptz
language plpgsql immutable parallel safe as $f$ begin return coalesce(((r -> -1) ->> 't')::timestamptz, c); end $f$;
create index if not exists mission_assignments_route_end_idx on public.mission_assignments (public.fs_route_end(route, completes_at));
do $$ declare src text; begin
  src := pg_get_viewdef('public.live_ambulances'::regclass, true);
  src := replace(src, 'COALESCE(((a.route -> ''-1''::integer) ->> ''t''::text)::timestamp with time zone, a.completes_at) > (now() - ''00:01:00''::interval)', 'fs_route_end(a.route, a.completes_at) > (now() - ''00:01:00''::interval)');
  if position('fs_route_end' in src) = 0 then raise exception 'patch non applicata'; end if;
  execute 'create or replace view public.live_ambulances as ' || src;
end $$;
-- 2) obiettivi / obiettivo d'alleanza / org_points: decine di migliaia di servizi a settimana per associazione,
--    ognuno unito a missions -> indici "coprenti" per leggere solo dagli indici (4-5 s -> 0,2 s).
create index if not exists mission_assignments_org_done_cover_idx on public.mission_assignments (org_id, completed_at)
  include (mission_id, reward_funds, auto, arrives_at, assigned_at, support) where status = 'conclusa';
create index if not exists missions_id_cover_idx on public.missions (id) include (code, category, transport, event_id, venue);
-- poi: vacuum (analyze) mission_assignments; vacuum (analyze) missions;  (servono per gli index-only scan)
