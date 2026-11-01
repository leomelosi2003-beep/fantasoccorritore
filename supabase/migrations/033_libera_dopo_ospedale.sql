-- L'ambulanza torna disponibile appena esce dall'ospedale (o dal posto): durante il rientro può prendere un altro servizio,
-- e il nuovo servizio parte da dove si trova in quel momento.

-- Dove si trova adesso il mezzo (lungo il percorso del suo ultimo servizio), altrimenti in sede
create or replace function vehicle_position(p_vehicle uuid, p_default geography) returns geography
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb; i int; a jsonb; b jsonb; ta timestamptz; tb timestamptz; f float8;
begin
  select route into r from mission_assignments where vehicle_id = p_vehicle and route is not null
   order by assigned_at desc limit 1;
  if r is null or jsonb_array_length(r) = 0 or (r->-1->>'t')::timestamptz <= now() then return p_default; end if;
  if (r->0->>'t')::timestamptz >= now() then
    return st_setsrid(st_makepoint((r->0->>'lng')::float8, (r->0->>'lat')::float8), 4326)::geography;
  end if;
  for i in 0 .. jsonb_array_length(r) - 2 loop
    a := r->i; b := r->(i + 1);
    ta := (a->>'t')::timestamptz; tb := (b->>'t')::timestamptz;
    if now() <= tb then
      f := case when tb > ta then extract(epoch from now() - ta) / extract(epoch from tb - ta) else 1 end;
      return st_setsrid(st_makepoint((a->>'lng')::float8 + ((b->>'lng')::float8 - (a->>'lng')::float8) * f,
                                     (a->>'lat')::float8 + ((b->>'lat')::float8 - (a->>'lat')::float8) * f), 4326)::geography;
    end if;
  end loop;
  return p_default;
end $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('v_start' in src) = 0 then
    src := replace(src, 'v_route jsonb;', 'v_route jsonb; v_start geography; v_free timestamptz;');
    src := replace(src, '  t0 := now();', '  t0 := now();
  v_start := vehicle_position(veh.id, b.location);');
    src := replace(src, 'leg_minutes(b.location, m.location, v_em)', 'leg_minutes(v_start, m.location, v_em)');
    src := replace(src, 'leg_minutes(b.location, h.location, v_back)', 'leg_minutes(v_start, h.location, v_back)');
    src := replace(src, 'route_point(b.location, t0, ''Sede'')', 'route_point(v_start, t0, ''Sede'')');
    -- libera appena riparte verso la sede (penultimo punto del percorso)
    src := replace(src, '  dist_km := st_distance(b.location, m.location) / 1000.0;',
'  v_free := coalesce((v_route->-2->>''t'')::timestamptz, t5);
  dist_km := st_distance(b.location, m.location) / 1000.0;');
    src := replace(src, 'values (m.id, v_org, veh.id, b.id, v_slot, round(dist_km, 2), t1, t5, h.id, v_route)',
                        'values (m.id, v_org, veh.id, b.id, v_slot, round(dist_km, 2), t1, v_free, h.id, v_route)');
    execute src;
  end if;

  src := pg_get_functiondef('travel_estimate(uuid,uuid)'::regprocedure);
  if position('vehicle_position' in src) = 0 then
    src := replace(src, 'st_distance(b.location, m.location)', 'st_distance(vehicle_position(v.id, b.location), m.location)');
    execute src;
  end if;
end $do$;

-- Le viste delle ambulanze mostrano anche il rientro in sede (fino alla fine del percorso)
create or replace view my_assignments with (security_invoker = true) as
SELECT a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.completed_at, a.reward_funds, a.distance_km, a.route,
    h.name AS hospital, m.title, m.code, m.reward_funds AS base_reward, v.call_sign,
    st_y((b.location)::geometry) AS base_lat, st_x((b.location)::geometry) AS base_lng,
    st_y((m.location)::geometry) AS lat, st_x((m.location)::geometry) AS lng,
    vm.image_url AS vehicle_image, a.vehicle_id, coalesce((a.route->-1->>'t')::timestamptz, a.completes_at) AS route_ends_at
   FROM mission_assignments a
     JOIN missions m ON m.id = a.mission_id
     JOIN vehicles v ON v.id = a.vehicle_id
     JOIN bases b ON b.id = a.base_id
     LEFT JOIN hospitals h ON h.id = a.hospital_id
     LEFT JOIN vehicle_models vm ON vm.id = v.model_id
  WHERE a.org_id = my_org_id() AND (a.status <> 'conclusa'::assignment_status OR a.completed_at > (now() - '02:00:00'::interval));

create or replace view live_ambulances with (security_invoker = true) as
select a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.route,
       m.title, m.code, v.call_sign, vm.image_url as vehicle_image,
       o.id as org_id, o.name as org_name, o.type as org_type, o.logo_url,
       h.name as hospital,
       st_y(b.location::geometry) as base_lat, st_x(b.location::geometry) as base_lng,
       st_y(m.location::geometry) as lat, st_x(m.location::geometry) as lng,
       a.vehicle_id, coalesce((a.route->-1->>'t')::timestamptz, a.completes_at) as route_ends_at
from mission_assignments a
join missions m on m.id = a.mission_id
join vehicles v on v.id = a.vehicle_id
join organizations o on o.id = a.org_id
join bases b on b.id = a.base_id
left join vehicle_models vm on vm.id = v.model_id
left join hospitals h on h.id = a.hospital_id
where coalesce((a.route->-1->>'t')::timestamptz, a.completes_at) > now() - interval '1 minute'
  and a.org_id is distinct from my_org_id();

select position('v_free' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as ok,
       (length(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure))
        - length(replace(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure), 'v_start', ''))) / 7 as usi_v_start;
