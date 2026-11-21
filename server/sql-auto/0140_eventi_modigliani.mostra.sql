\pset pager off
select 'MIS', m.venue, m.title, e.kind, m.event_ends_at > now() attivo from missions m left join events e on e.id = m.event_id
 where m.event_id is not null and (m.venue ilike '%modigliani%' or m.title ilike '%modigliani%' or m.title ilike '%nigiotti%') order by m.created_at desc limit 5;
