\pset pager off
select 'TICK', count(*), round(avg(extract(epoch from end_time-start_time))::numeric,2) media_s, round(max(extract(epoch from end_time-start_time))::numeric,2) max_s
  from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='game-tick' and d.start_time > now() - interval '1 hour';
select 'LOG', at, phase, round(secs::numeric,1) from tick_log where at > now() - interval '3 hours' order by secs desc limit 10;
select 'STMT', calls, round(mean_exec_time::numeric) ms_medi, round(total_exec_time::numeric/1000) s_tot, left(regexp_replace(query, '\s+', ' ', 'g'), 110)
  from pg_stat_statements order by total_exec_time desc limit 15;
select 'SIZE', relname, pg_size_pretty(pg_total_relation_size(relid)), n_live_tup, n_dead_tup, seq_scan from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 12;
select 'DB', pg_size_pretty(pg_database_size(current_database()));
select 'CONN', state, count(*) from pg_stat_activity group by state;
