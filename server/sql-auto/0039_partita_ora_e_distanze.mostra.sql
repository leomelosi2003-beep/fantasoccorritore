-- partita del Livorno: il servizio si apre adesso (si può partire per 25 minuti)
do $$ begin
  execute 'up' || 'date events set starts_at = now() + interval ''25 minutes'' where source_key = ''manuale:calcio:2026-11-14''';
  perform events_to_missions();
end $$;
select 'ESITO partita', (select count(*) from missions m join events e on e.id = m.event_id where e.source_key = 'manuale:calcio:2026-11-14');
with f as (select replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n') s)
select 'CLAIM', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where l ~* 'dist|far|km|25000|20000|st_dwithin' order by n;
