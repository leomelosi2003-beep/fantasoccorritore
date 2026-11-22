\pset pager off
select 'CTX', left(regexp_replace(regexp_replace(m[1], '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'), 260) from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '(.{0,250}href="/wp/match/ita2_4(?:42|55|69)/ita2/x2627".{0,250})', 'g') m where p.label='lnp' limit 3;
select 'M', r.status_code, length(r.content) from score_probe p join net._http_response r on r.id = p.id where p.label='lnp_m455';
select 'MJ', m[1] from score_probe p join net._http_response r on r.id = p.id,
  regexp_matches(r.content, '((?:https?:)?//[a-z0-9.\-]+/[^"'' ]*(?:json|api|live|data)[^"'' ]*)', 'g') m where p.label='lnp_m455' limit 15;
select 'MT', left(regexp_replace(regexp_replace(r.content, '<script.*?</script>|<style.*?</style>', ' ', 'g'), '<[^>]+>|\s+', ' ', 'g'), 1500) from score_probe p join net._http_response r on r.id = p.id where p.label='lnp_m455';
