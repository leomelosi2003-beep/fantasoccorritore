\pset pager off
select 'RT', i, l from regexp_split_to_table(replace(pg_get_functiondef('run_tick_task'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
 where l ~* 'dispatch|medical|auto_' ;
select 'AUTO', count(*) filter (where auto_enabled), count(*) from organizations;
select 'AD', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i < 120;
