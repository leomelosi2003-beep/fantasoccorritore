select cron.schedule('maxi-patients', '* * * * *', 'select public.maxi_patients_tick()');
select 'ESITO cron', jobname, schedule from cron.job where jobname = 'maxi-patients';
