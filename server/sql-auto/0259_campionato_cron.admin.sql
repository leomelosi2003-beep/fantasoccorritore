-- 0259: ogni lunedì a mezzanotte (ora italiana d'inverno) promozioni e retrocessioni del campionato
select cron.schedule('division-rollover', '5 23 * * 0', 'select public.division_rollover()');
do $$ begin raise notice 'ESITO cron campionato attivo'; end $$;
