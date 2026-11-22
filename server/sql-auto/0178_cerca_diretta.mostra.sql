\pset pager off
select 'IF', left(m[1], 220) from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '((?:src|href|data-[a-z-]+)="[^"]*(?:genius|fiba|livestat|lnpstat|iframe|widget|live)[^"]*")', 'gi') m where p.label='lnp_m455' limit 15;
select 'IF2', left(m[1], 220) from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '(<iframe[^>]*>)', 'gi') m where p.label='lnp_m455' limit 5;
