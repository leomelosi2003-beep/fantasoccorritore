select cron.schedule('auto-refuel', '*/2 * * * *', 'select public.auto_refuel_all()');
do $$ begin raise notice 'ESITO cron pieno automatico'; end $$;
