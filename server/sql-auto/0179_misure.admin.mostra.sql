\pset pager off
select 'LOAD', pg_read_file('/proc/loadavg'), (select count(*) from regexp_matches(pg_read_file('/proc/cpuinfo'), 'processor', 'g')) cpu;
select 'MEM', left(regexp_replace(pg_read_file('/proc/meminfo'), '\s+', ' ', 'g'), 200);
select 'TICK', count(*), round(avg(extract(epoch from end_time-start_time))::numeric,2), round(max(extract(epoch from end_time-start_time))::numeric,2)
  from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='game-tick' and d.start_time > now() - interval '1 hour';
select 'JOBS', j.jobname, j.schedule, count(*), round(avg(extract(epoch from end_time-start_time))::numeric,2) from cron.job_run_details d join cron.job j on j.jobid=d.jobid
 where d.start_time > now() - interval '1 hour' group by 2,3 order by 5 desc limit 10;
select 'STMT', calls, round(mean_exec_time::numeric) ms, round(total_exec_time::numeric/1000) s, left(regexp_replace(query, '\s+', ' ', 'g'), 120)
  from pg_stat_statements where query not ilike '%game_tick%' order by total_exec_time desc limit 20;
select 'CONF', name, setting, unit from pg_settings where name in ('shared_buffers','work_mem','effective_cache_size','max_connections','random_page_cost','jit','max_parallel_workers_per_gather');
