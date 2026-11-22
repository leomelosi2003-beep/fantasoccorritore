\pset pager off
select 'R', p.label, r.status_code, length(r.content), left(regexp_replace(coalesce(r.content, r.error_msg), '\s+', ' ', 'g'), 260)
  from score_probe p left join net._http_response r on r.id = p.id order by p.label;
