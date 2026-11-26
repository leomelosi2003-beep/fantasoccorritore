select cron.schedule('season-cache', '*/2 * * * *', 'select public.refresh_season_cache()');
do $$ begin raise notice 'ESITO cron cache classifiche'; end $$;
