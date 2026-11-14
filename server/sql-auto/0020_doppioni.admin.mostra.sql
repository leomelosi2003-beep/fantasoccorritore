-- servizi aperti uno sopra l'altro (nessun dato personale)
select 'DUP', round(st_y(location::geometry)::numeric,4) lat, round(st_x(location::geometry)::numeric,4) lng, count(*) n,
       string_agg(distinct category::text, ',') cat, string_agg(distinct coalesce(source,'?'), ',') src, string_agg(distinct status::text, ',') st,
       min(created_at) primo, max(created_at) ultimo, string_agg(distinct left(title,30), ' | ') titoli
  from missions where status in ('aperta','completa','in_corso')
 group by 1,2,3 having count(*) > 1 order by n desc limit 25;
select 'TOT', status, count(*) from missions where status in ('aperta','completa','in_corso') group by status;
select 'CRON', jobname, schedule, active, left(command, 80) from cron.job order by jobname;
select 'TICK', task, last_run, every_s from tick_state order by task;
