select 'DEF', pg_get_functiondef('public.spawn_maxi_if_due'::regproc);
select 'ULTIME', created_at, status, coalesce(event_ends_at, expires_at) fine, left(title, 50) from missions
 where category = 'grande_evento' and event_id is null and coalesce(venue, '') <> 'AIB' order by created_at desc limit 5;
