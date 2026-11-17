select 'FN', p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p where p.proname in ('aib_fire_route','aib_leg_seconds') and p.pronamespace = 'public'::regnamespace;
select 'CLAIM', n, l from (select row_number() over () n, l from regexp_split_to_table(replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') l) x where l ilike '%aib%';
select 'AIBATTIVI', count(*) from mission_assignments a join missions m on m.id = a.mission_id where m.venue = 'AIB' and a.status not in ('conclusa','annullata');
