-- 0244: il motore di tornei e sfide gira ogni 2 minuti (leggero: lavora solo sugli incontri aperti)
select cron.schedule('tournaments', '*/2 * * * *', 'select public.tournament_tick()');
do $$ begin raise notice 'ESITO cron tornei attivo'; end $$;
