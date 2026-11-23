\pset pager off
select 'LOG', at, task, ms from tick_log where at > now() - interval '6 minutes' order by at desc limit 20;
select 'TICK', round(avg(extract(epoch from end_time-start_time))::numeric,2), round(max(extract(epoch from end_time-start_time))::numeric,2), count(*)
  from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='game-tick' and d.start_time > now() - interval '5 minutes';
