\pset pager off
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i between 1 and 12 or i between 74 and 96;
