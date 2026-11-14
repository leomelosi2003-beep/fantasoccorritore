select 'FETCH', source, requested_at, processed_at, left(coalesce(result,''), 120) from event_fetches order by requested_at desc limit 12;
select 'RESP', r.id, r.status_code, length(r.content) len, left(coalesce(r.error_msg,''), 100) from net._http_response r order by r.id desc limit 6;
select 'EV', kind, title, show_at, locked from events where show_at > now() - interval '1 day' order by show_at limit 20;
select 'CALCIO', title, show_at from events where kind = 'calcio' order by show_at desc limit 5;
