select cron.schedule('rank-snapshot', '2 * * * *', 'select public.take_rank_snapshot()');
do $$ begin raise notice 'ESITO cron fotografie classifiche'; end $$;
