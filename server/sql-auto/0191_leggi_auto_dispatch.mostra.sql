\pset pager off
select 'AD0', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
