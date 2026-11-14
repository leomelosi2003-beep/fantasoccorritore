select pg_get_functiondef('public.maxi_scenario'::regproc);
select 'ESITO maxi passate: ' || count(*) from missions where category = 'grande_evento' and event_id is null and venue = 'MAXI';
