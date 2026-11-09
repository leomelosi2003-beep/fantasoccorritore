-- 194: il servizio sparisce dalla mappa appena l'ultimo mezzo lascia il posto (verso l'ospedale o la sede),
-- anche se aveva ancora posti liberi. Prima restava visibile finché non era pieno.
do $$
declare v text; old text := '(status <> ''aperta''::mission_status OR slots_taken >= slots_total) AND ';
begin
  v := pg_get_viewdef('public.missions_map'::regclass, true);
  if position(old in v) = 0 then raise notice 'vista già aggiornata'; return; end if;
  v := replace(v, old, '');
  execute 'create or replace view public.missions_map with (security_invoker = false) as ' || v;
end $$;
