insert into score_probe(id, label) values
 (net.http_get('https://www.legapallacanestro.com/wp/match/ita2_455/ita2/x2627', headers => '{"User-Agent":"Mozilla/5.0"}'::jsonb), 'lnp_m455');
do $$ begin raise notice 'ESITO ok'; end $$;
