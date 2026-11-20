select cron.schedule('fix-on-return', '* * * * *', 'select public.run_fix_on_return()');
select 'ESITO cron', jobname, schedule from cron.job where jobname = 'fix-on-return';
