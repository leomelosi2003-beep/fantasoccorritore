-- 0269: ogni 5 minuti tolgo i regali rimasti (mezzi e volontari che erano in servizio)
select cron.schedule('gift-revoke', '*/5 * * * *', 'select public.gift_revoke()');
do $$ begin raise notice 'ESITO controllo regali attivo'; end $$;
