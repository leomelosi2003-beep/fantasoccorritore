select 'WT', pg_get_functiondef('public.wealth_tax'::regproc);
select 'PL', pg_get_functiondef('public.purge_ledger'::regproc);
select 'TBL', table_name from information_schema.tables where table_schema='public' and table_name ~ 'ledger|money|movim|transaz';
select 'ORG', id, created_at from organizations where name = 'Croce Verde Livorno';
