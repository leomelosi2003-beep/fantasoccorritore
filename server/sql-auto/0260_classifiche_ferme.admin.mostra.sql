\pset pager off
select 'cache', max(updated_at), count(*) from public.season_board_cache;
select 'snap', max(taken_at) from public.rank_snapshots;
select j.jobname, d.status, left(d.return_message, 200), d.start_time
  from cron.job j join lateral (select * from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 2) d on true
 where j.jobname in ('season-cache', 'rank-snapshot', 'tournaments', 'game-tick') order by j.jobname, d.start_time desc;
