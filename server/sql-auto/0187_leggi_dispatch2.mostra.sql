\pset pager off
select 'AD', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i >= 119;
