-- ogni domenica alle 23 (ora italiana d'inverno = 22 UTC) il fondo di ogni alleanza si divide tra le associazioni
select cron.schedule('alliance-payout', '0 22 * * 0', $$select public.alliance_weekly_payout()$$);
select 'ESITO cron', jobname, schedule from cron.job where jobname = 'alliance-payout';
