\pset pager off
select column_name from information_schema.columns where table_name = 'rank_snapshots' order by ordinal_position;
select j.jobname, d.status, left(d.return_message, 160), d.start_time
  from cron.job j join lateral (select * from cron.job_run_details x where x.jobid = j.jobid order by start_time desc limit 2) d on true
 where j.jobname in ('season-cache', 'rank-snapshot', 'tournaments') order by j.jobname, d.start_time desc;
-- confronto cache e calcolo diretto (solo numeri)
select 'confronto', count(*) filter (where c.points is distinct from s.points) diversi_punti, count(*) totale
  from season_board() s full join season_board_cache c on c.org_id = s.org_id;
select 'leaderboard_v2 righe', count(*) from leaderboard_v2;
select 'pgrst', proname, pg_get_function_result(oid) from pg_proc where proname in ('season_board_fast','maxi_board','mare_board','fires_board','pc_board');
