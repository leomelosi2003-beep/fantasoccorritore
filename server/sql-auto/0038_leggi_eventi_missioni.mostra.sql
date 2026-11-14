select 'DEF', pg_get_functiondef('public.events_to_missions'::regproc);
select 'EV', e.id, e.starts_at, e.ends_at, e.show_at, (select count(*) from missions m where m.event_id = e.id) from events e where e.source_key = 'manuale:calcio:2026-11-14';
