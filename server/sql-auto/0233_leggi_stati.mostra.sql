\pset pager off
select 'E', t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname in ('mission_status','assignment_status') group by 1;
select 'M', m.status, m.expires_at, m.event_ends_at, p.injured, p.transported, p.orig_end from missions m left join maxi_patients p on p.mission_id = m.id where m.title ilike '%Lamezia%' and m.event_id is null order by m.created_at desc limit 3;
select 'X', count(*) from missions m where m.category='grande_evento' and m.event_id is null and m.status in ('aperta','completa','in_corso') and m.event_ends_at < now() - interval '1 hour';
