\pset pager off
select 'MAXI', m.id, m.title, st_y(m.location::geometry), st_x(m.location::geometry), m.event_ends_at from missions m
 where m.category='grande_evento' and m.event_id is null and coalesce(m.venue,'') not in ('AIB','PC') and m.status in ('aperta','completa','in_corso');
select 'ASS', a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, round(a.distance_km), jsonb_array_length(a.route),
  (select string_agg(coalesce(x->>'label','-') || '@' || to_char((x->>'t')::timestamptz at time zone 'Europe/Rome','HH24:MI') || '(' || round((x->>'lat')::numeric,2) || ',' || round((x->>'lng')::numeric,2) || ')', ' | ' order by i) from jsonb_array_elements(a.route) with ordinality q(x,i))
 from mission_assignments a join missions m on m.id=a.mission_id
 where m.category='grande_evento' and m.event_id is null and coalesce(m.venue,'') not in ('AIB','PC') and m.status in ('aperta','completa','in_corso') and a.status in ('in_viaggio','sul_posto') limit 20;
select 'FN', p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('route_point','vehicle_position','drive_seconds','hospital_gates','island_of','road_route','sea_route_points');
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'v_route|t1 :=|t5 :=|arrives_at|completes_at|v_vmax :=|v_boost :=|v_agi :=';
