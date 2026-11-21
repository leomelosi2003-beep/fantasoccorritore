select cron.schedule('livery-contest-close', '30 1 1 * *', 'select public.livery_contest_close()');
select 'ESITO cron', jobname, schedule from cron.job where jobname = 'livery-contest-close';
