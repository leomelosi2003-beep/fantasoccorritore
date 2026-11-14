\pset pager off
select 'ESITO colonne bases: ' || string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='bases';
select 'FUNZIONI: ' || string_agg(p.oid::regprocedure::text, ', ') from pg_proc p where pronamespace='public'::regnamespace and (proname ilike '%base%') ;
select '--- ' || p.oid::regprocedure::text || E'\n' || pg_get_functiondef(p.oid) from pg_proc p where pronamespace='public'::regnamespace and proname in ('build_base','base_build_cost','base_cost','upgrade_base','base_upgrade_cost','close_base_auctions','base_market_value');
select 'SEDI per associazione: ' || string_agg(n::text, ',' order by n desc) from (select count(*) n from bases group by org_id) t;
select 'SOLDI associazioni (milioni): ' || string_agg(round(funds/1e6,1)::text, ',' order by funds desc) from organizations;
select 'ENTRATE 24h per assoc (k€): ' || string_agg(round(s/1e3)::text, ',' order by s desc) from (select org_id, sum(reward_funds) s from mission_assignments where completed_at > now()-interval '24 hours' group by org_id) t;
