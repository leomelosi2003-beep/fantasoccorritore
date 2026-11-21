\pset pager off
select 'AD', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i between 168 and 222;
select 'PK', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_pick_crew'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
