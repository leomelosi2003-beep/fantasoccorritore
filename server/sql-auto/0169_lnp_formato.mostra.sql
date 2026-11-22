\pset pager off
with t as (select regexp_replace(regexp_replace(r.content, '<[^>]+>', '|', 'g'), '\s*\|[\s|]*', '|', 'g') x from score_probe p join net._http_response r on r.id = p.id where p.label='lnp')
select 'P', m[1], m[2], m[3], m[4], m[5], m[6], m[7] from t, regexp_matches(t.x, '\|(\d{1,3}) - (\d{1,3})\|([^|]+)\|(\d{2}/\d{2}/\d{4})[ |]*(\d{2}:\d{2})?\|([^|]+)\|([^|]+)\|', 'g') m limit 12;
with t as (select regexp_replace(regexp_replace(r.content, '<[^>]+>', '|', 'g'), '\s*\|[\s|]*', '|', 'g') x from score_probe p join net._http_response r on r.id = p.id where p.label='lnp')
select 'F', left(m[1], 300) from t, regexp_matches(t.x, '(.{0,120}2[0-9]/11/2026.{0,160})', 'g') m limit 6;
