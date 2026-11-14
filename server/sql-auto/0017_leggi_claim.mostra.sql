with f as (select replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n') s)
select 'CLAIM', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where n between 70 and 140 or l ~* 'certif' order by n;
with f as (select replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n') s)
select 'CDA', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where n between 88 and 100 order by n;
select 'FLEETDEF', pg_get_viewdef('public.my_fleet'::regclass, true);
select 'EQCOLS', string_agg(column_name||':'||data_type||':'||coalesce(column_default,'-')||':'||is_nullable, ', ') from information_schema.columns where table_name='equipment' and table_schema='public';
select 'VMCOLS', string_agg(column_name||':'||coalesce(column_default,'-')||':'||is_nullable, ', ') from information_schema.columns where table_name='vehicle_models' and table_schema='public';
select 'CHK', conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.equipment'::regclass, 'public.vehicle_models'::regclass) and contype='c';
