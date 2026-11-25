select cron.schedule('rank-snapshot', '2,32 * * * *', 'select public.take_rank_snapshot()');
do $$ begin raise notice 'ESITO fotografie ogni 30 minuti'; end $$;
