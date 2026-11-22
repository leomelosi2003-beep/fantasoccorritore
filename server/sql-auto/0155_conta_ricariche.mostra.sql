\pset pager off
create temp table _c as select queryid, calls from pg_stat_statements where query like 'WITH base_types AS%' or query like '%pgrst_source%' ;
select pg_sleep(90);
select 'DELTA', s.calls - c.calls delta, left(regexp_replace(s.query, '\s+', ' ', 'g'), 90) from pg_stat_statements s join _c c using (queryid) where s.calls - c.calls > 0 order by 2 desc limit 15;
select 'RESET', stats_reset from pg_stat_statements_info;
