select 'MAXI', pg_get_functiondef('public.spawn_maxi_emergency'::regproc);
select 'FIRE', pg_get_functiondef('public.spawn_wildfire'::regproc);
select 'TICKF', pg_get_functiondef('public.tick_wildfires'::regproc);
select 'NFIRE', count(*), max(created_at) from missions where venue = 'AIB';
