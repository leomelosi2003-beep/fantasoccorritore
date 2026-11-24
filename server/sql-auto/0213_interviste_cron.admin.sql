select cron.schedule('press-interviews', '5 9 * * *', 'select public.press_request_interviews(2)');
do $$ begin raise notice 'ESITO cron interviste'; end $$;
