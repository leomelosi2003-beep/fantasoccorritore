\pset pager off
select 'LV', i, l from regexp_split_to_table(replace(pg_get_functiondef('leave_alliance'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'LED', column_name, data_type from information_schema.columns where table_name='ledger' order by ordinal_position;
