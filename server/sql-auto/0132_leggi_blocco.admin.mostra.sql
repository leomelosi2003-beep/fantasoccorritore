\pset pager off
select 'TICK', j.jobname, d.status, left(coalesce(d.return_message,''),160), to_char(d.start_time at time zone 'Europe/Rome','HH24:MI:SS'), round(extract(epoch from d.end_time-d.start_time)::numeric,1)
  from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname in ('game-tick','fix-on-return','maxi-patients') order by d.start_time desc limit 12;
select 'ERR', j.jobname, count(*), max(left(d.return_message,200)) from cron.job_run_details d join cron.job j on j.jobid=d.jobid
  where d.status <> 'succeeded' and d.start_time > now() - interval '3 hours' group by 2;
select 'STUCK', count(*) filter (where completes_at < now() - interval '10 minutes'), count(*) from mission_assignments where status in ('in_viaggio','sul_posto');
select 'TICKST', task, last_run at time zone 'Europe/Rome' from tick_state order by 2 limit 20;
select 'LOG', to_char(at at time zone 'Europe/Rome','HH24:MI'), left(t::text, 200) from tick_log t order by at desc limit 8;
select 'CREW', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
  where l ~* 'CREW|required_roles|role_rank|autista|avanzat|NEED_|MISSING_ROLE|NO_DRIVER' limit 60;
