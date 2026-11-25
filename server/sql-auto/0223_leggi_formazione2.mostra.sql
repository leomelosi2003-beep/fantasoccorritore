\pset pager off
select 'TC', i, l from regexp_split_to_table(replace(pg_get_functiondef('training_class'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'TD', i, l from regexp_split_to_table(replace(pg_get_functiondef('train_drivers'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'ST', state, count(*) from card_inventory group by 2;
select 'COL', column_name, data_type from information_schema.columns where table_name='card_inventory' order by ordinal_position;
