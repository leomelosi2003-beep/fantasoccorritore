select cron.schedule('livery-runoff-close', '17 * * * *', 'select public.livery_runoff_close()');
do $$ begin raise notice 'ESITO cron spareggio livree'; end $$;
