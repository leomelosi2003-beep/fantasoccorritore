\pset pager off
select 'AHC', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_hour_cost_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'ASC', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_shift_hour_cost'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'TAB', table_name from information_schema.columns where column_name = 'reason' and table_schema='public';
