\pset pager off
select 'MAXI', m.id, m.title, m.status, m.event_ends_at at time zone 'Europe/Rome', m.expires_at at time zone 'Europe/Rome', p.injured, round(p.transported,1), p.orig_end at time zone 'Europe/Rome'
  from missions m left join maxi_patients p on p.mission_id = m.id
 where m.category='grande_evento' and m.event_id is null and coalesce(m.venue,'') not in ('AIB','PC') and m.created_at > now() - interval '2 days';
select 'ASS', a.mission_id, a.status, to_char(a.arrives_at at time zone 'Europe/Rome','HH24:MI'), to_char(a.completes_at at time zone 'Europe/Rome','HH24:MI'),
  to_char((a.route->-2->>'t')::timestamptz at time zone 'Europe/Rome','HH24:MI') stay_end, to_char((a.route->-1->>'t')::timestamptz at time zone 'Europe/Rome','HH24:MI') sede,
  a.route->-2->>'label', a.route->-1->>'label'
 from mission_assignments a join missions m on m.id=a.mission_id
 where m.category='grande_evento' and m.event_id is null and coalesce(m.venue,'') not in ('AIB','PC') and m.created_at > now() - interval '2 days' and a.status <> 'annullata'
 order by a.assigned_at desc limit 40;
select 'CRON', j.jobname, d.status, left(coalesce(d.return_message,''),100), to_char(d.start_time at time zone 'Europe/Rome','HH24:MI') from cron.job_run_details d join cron.job j on j.jobid=d.jobid
 where j.jobname in ('maxi-patients') order by d.start_time desc limit 3;
select 'CDA', l from regexp_split_to_table(replace(pg_get_functiondef('complete_due_assignments'::regproc), E'\r\n', E'\n'), E'\n') l where l ~* 'completes_at|sul_posto|event_ends' limit 20;
