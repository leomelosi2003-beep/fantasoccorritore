\pset pager off
select 'LOG', * from tick_log where at > now() - interval '2 hours' order by at desc limit 25;
select 'PGRST', usename, application_name, count(*), min(backend_start), max(backend_start) from pg_stat_activity where usename in ('authenticator') group by 2,3;
select 'SET', name, setting from pg_settings where name in ('jit','effective_cache_size','random_page_cost','work_mem','shared_buffers');
