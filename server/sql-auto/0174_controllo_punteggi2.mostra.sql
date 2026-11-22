\pset pager off
select 'ATT', e.kind, e.title, to_char(e.show_at at time zone 'Europe/Rome', 'DD/MM HH24:MI') from events e where e.kind in ('basket','calcio') and e.show_at between now() - interval '6 hours' and now() + interval '1 day';
select 'SC', e.title, s.team1, s.score1, s.score2, s.team2, s.updated_at from event_scores s join events e on e.id = s.event_id;
select 'FE', source, processed, count(*) from score_fetches group by 2,3;
select 'JOB', jobname, schedule from cron.job where jobname = 'event-scores';
