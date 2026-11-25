\pset pager off
select 'MC', m[1] from regexp_matches(pg_get_viewdef('my_cards'::regclass, true), '([^,\n]*avanzato[^,\n]*)', 'g') m;
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'avanzato';
select 'COL', column_name from information_schema.columns where table_name='volunteers' and column_name ilike '%avanz%';
