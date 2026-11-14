select cron.schedule('base-perks', '10 * * * *', 'select public.pay_base_perks()');
select 'ESITO cron ' || jobname || ' ' || schedule from cron.job where jobname = 'base-perks';
