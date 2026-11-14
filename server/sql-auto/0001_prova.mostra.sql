select 'ESITO ok' as x, now()::text as ora, (select count(*) from organizations) as associazioni;
