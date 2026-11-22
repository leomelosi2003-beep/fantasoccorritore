\pset pager off
select 'VL', i, l from regexp_split_to_table(replace(pg_get_functiondef('vehicle_liveries'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'LS', i, l from regexp_split_to_table(replace(pg_get_functiondef('livery_save2'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'COLS', column_name, data_type from information_schema.columns where table_name='liveries' order by ordinal_position;
