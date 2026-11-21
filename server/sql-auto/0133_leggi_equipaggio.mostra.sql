\pset pager off
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i between 116 and 153;
select 'FN', p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname ~* 'crew|pick' ;
select 'AD', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'crew|card|autista|avanzat|rank|required';
select 'REQ', required_roles::text, count(*) from missions where status = 'aperta' group by 2 order by 3 desc limit 12;
