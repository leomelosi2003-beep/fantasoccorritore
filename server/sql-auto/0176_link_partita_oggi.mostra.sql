\pset pager off
select 'LK', m[1] from score_fetches f join net._http_response r on r.id = f.id,
  regexp_matches(r.content, '22/11/2026.{0,600}?(/wp/match/[^"]+)', 'g') m where f.source = 'libertas' and r.status_code = 200 limit 2;
