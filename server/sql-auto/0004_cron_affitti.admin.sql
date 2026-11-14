select cron.schedule('base-rent', '5 * * * *', 'select public.charge_base_rent()');
select 'ESITO cron ' || jobname || ' ' || schedule from cron.job where jobname = 'base-rent';
