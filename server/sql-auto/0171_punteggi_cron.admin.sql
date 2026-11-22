select cron.schedule('event-scores', '*/2 * * * *', 'select public.scores_tick()');
do $$ begin raise notice 'ESITO cron punteggi'; end $$;
