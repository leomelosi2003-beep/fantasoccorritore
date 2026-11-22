\pset pager off
select 'JOB', jobname, schedule, left(command, 300) from cron.job where jobname ilike '%event%';
select 'FN', p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.proname ilike '%event%';
select 'COLS', column_name, data_type from information_schema.columns where table_schema='public' and table_name='events' order by ordinal_position;
select 'EV', e.kind, e.title, e.venue, e.starts_at, e.source, e.external_id from events e where e.starts_at > now() - interval '1 day' and e.kind in ('calcio','basket') order by e.starts_at limit 15;
