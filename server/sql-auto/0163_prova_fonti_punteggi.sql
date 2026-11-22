-- prova quali siti di risultati rispondono al server (solo lettura, nessun dato di gioco)
create table if not exists public.score_probe(id bigint, label text, at timestamptz default now());
insert into score_probe(id, label) values
 (net.http_get('https://api.sofascore.com/api/v1/search/all?q=libertas%20livorno', headers => '{"User-Agent":"Mozilla/5.0","Accept":"application/json"}'::jsonb), 'sofa_search'),
 (net.http_get('https://www.sofascore.com/api/v1/search/all?q=libertas%20livorno', headers => '{"User-Agent":"Mozilla/5.0","Accept":"application/json"}'::jsonb), 'sofa_www'),
 (net.http_get('https://www.eurosport.it/basket/serie-a2/2025-2026/calendario-risultati.shtml', headers => '{"User-Agent":"Mozilla/5.0"}'::jsonb), 'eurosport'),
 (net.http_get('https://www.fotmob.com/api/search/suggest?term=livorno', headers => '{"User-Agent":"Mozilla/5.0"}'::jsonb), 'fotmob'),
 (net.http_get('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Livorno', headers => '{"User-Agent":"Mozilla/5.0"}'::jsonb), 'tsdb'),
 (net.http_get('https://www.legapallacanestro.com/serie-a2/libertas-livorno-1947'), 'lnp');
do $$ begin raise notice 'ESITO richieste inviate'; end $$;
