\pset pager off
select 'L', m[1] from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '(href="[^"]*(?:partita|game|match|gara)[^"]*")', 'g') m where p.label='lnp' limit 15;
select 'S', left(regexp_replace(m[1], '\s+', ' ', 'g'), 300) from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '((?:<[^>]*>\s*)*\d{2,3}\s*(?:<[^>]*>\s*)*[-–]\s*(?:<[^>]*>\s*)*\d{2,3}(?:\s*<[^>]*>){0,6})', 'g') m where p.label='lnp' limit 8;
