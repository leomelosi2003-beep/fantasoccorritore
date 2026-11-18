select 'FN', p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and pg_get_functiondef(p.oid) like '%''Rientro''%';
select 'SNAP', column_name from information_schema.columns where table_name = 'org_snapshots';
