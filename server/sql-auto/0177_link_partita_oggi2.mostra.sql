\pset pager off
select 'LK', m[1] from score_fetches f join net._http_response r on r.id = f.id,
  regexp_matches(regexp_replace(r.content, '\s+', ' ', 'g'), '22/11/2026(?:[^/]|/(?!wp/match)){0,250}(/wp/match/[a-z0-9_/]+)', 'g') m where f.source = 'libertas' and r.status_code = 200 limit 3;
select 'LK2', m[1] from score_fetches f join net._http_response r on r.id = f.id,
  regexp_matches(r.content, '(/wp/match/[a-z0-9_/]+)', 'g') m where f.source = 'libertas' and r.status_code = 200 group by 2 order by 2 limit 40;
