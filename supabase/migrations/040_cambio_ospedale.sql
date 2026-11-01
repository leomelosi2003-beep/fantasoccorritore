-- CAMBIO OSPEDALE DI DESTINAZIONE per un servizio in corso (prima di arrivare in ospedale)

-- Punto del percorso da cui ripartire: se è ancora sul posto riparte quando finisce il soccorso,
-- se sta già andando in ospedale riparte da dove si trova adesso.
create or replace function hospital_options(p_assignment uuid)
returns table (id uuid, name text, minutes int, current boolean, specialized boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare a mission_assignments; m missions; sf numeric; v_em numeric; start_pt geography;
begin
  select * into a from mission_assignments x where x.id = p_assignment and x.org_id = my_org_id();
  if not found then return; end if;
  select * into m from missions where missions.id = a.mission_id;
  sf := (select speed_factor from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id);
  v_em := (case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end) * sf;
  start_pt := coalesce(vehicle_position(a.vehicle_id, m.location), m.location);
  return query
    select h.id, h.name, round(leg_minutes(start_pt, h.location, v_em))::int, h.id = a.hospital_id,
           m.transport = any(h.capabilities)
      from hospitals h where cardinality(h.capabilities) > 0
     order by leg_minutes(start_pt, h.location, v_em);
end $$;

create or replace function change_hospital(p_assignment uuid, p_hospital uuid) returns mission_assignments
language plpgsql security definer set search_path = public, extensions as $$
declare a mission_assignments; m missions; h hospitals; b bases; sf numeric; v_em numeric; v_back numeric;
        r jsonb; outr jsonb := '[]'; i int; p jsonb; scene_end timestamptz; arrive_h timestamptz;
        t_start timestamptz; start_pt geography; t3 timestamptz; t4 timestamptz; t5 timestamptz;
begin
  select * into a from mission_assignments where id = p_assignment and org_id = my_org_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into m from missions where id = a.mission_id;
  if m.transport is null or m.transport in ('trasferimento', 'dimissione') or m.event_ends_at is not null then
    raise exception 'NO_HOSPITAL_CHANGE'; end if;
  if a.hospital_id = p_hospital then return a; end if;
  select * into h from hospitals where id = p_hospital and cardinality(capabilities) > 0;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into b from bases where id = a.base_id;
  sf := (select speed_factor from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id);
  v_em := (case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end) * sf;
  v_back := 40 * sf;
  r := a.route;

  -- fine del soccorso = ultimo punto "Sul posto"; arrivo in ospedale = primo punto dopo
  select max((e->>'t')::timestamptz) into scene_end from jsonb_array_elements(r) e where e->>'label' = 'Sul posto';
  select min((e->>'t')::timestamptz) into arrive_h from jsonb_array_elements(r) e
   where e->>'label' not in ('Sul posto', 'Sede') and (e->>'t')::timestamptz > scene_end;
  if arrive_h is null or now() >= arrive_h then raise exception 'ALREADY_AT_HOSPITAL'; end if;

  if now() < scene_end then
    -- ancora sul posto: tiene il percorso fino alla fine del soccorso
    for i in 0 .. jsonb_array_length(r) - 1 loop
      p := r->i;
      exit when (p->>'t')::timestamptz > scene_end;
      outr := outr || jsonb_build_array(p);
    end loop;
    t_start := scene_end; start_pt := m.location;
  else
    -- sta già andando in ospedale: riparte da dove si trova adesso
    for i in 0 .. jsonb_array_length(r) - 1 loop
      p := r->i;
      exit when (p->>'t')::timestamptz > now();
      outr := outr || jsonb_build_array(p);
    end loop;
    t_start := now(); start_pt := vehicle_position(a.vehicle_id, m.location);
    outr := outr || jsonb_build_array(route_point(start_pt, t_start, 'Sul posto'));
  end if;

  t3 := t_start + make_interval(secs => leg_minutes(start_pt, h.location, v_em) * 60);
  t4 := t3 + interval '2 minutes';
  t5 := t4 + make_interval(secs => leg_minutes(h.location, b.location, v_back) * 60);
  outr := outr || jsonb_build_array(route_point(h.location, t3, h.name), route_point(h.location, t4, h.name),
                                    route_point(b.location, t5, 'Sede'));
  outr := hospital_gates(outr);

  update mission_assignments set route = outr, hospital_id = h.id,
         completes_at = greatest(now(), (outr->-2->>'t')::timestamptz)
   where id = a.id returning * into a;
  return a;
end $$;
grant execute on function hospital_options(uuid), change_hospital(uuid, uuid) to authenticated;

-- il pannello Mezzi ha bisogno del tipo di trasporto
create or replace view my_assignments with (security_invoker = true) as
SELECT a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.completed_at, a.reward_funds, a.distance_km, a.route,
    h.name AS hospital, m.title, m.code, m.reward_funds AS base_reward, v.call_sign,
    st_y((b.location)::geometry) AS base_lat, st_x((b.location)::geometry) AS base_lng,
    st_y((m.location)::geometry) AS lat, st_x((m.location)::geometry) AS lng,
    vm.image_url AS vehicle_image, a.vehicle_id, coalesce((a.route->-1->>'t')::timestamptz, a.completes_at) AS route_ends_at,
    m.transport
   FROM mission_assignments a
     JOIN missions m ON m.id = a.mission_id
     JOIN vehicles v ON v.id = a.vehicle_id
     JOIN bases b ON b.id = a.base_id
     LEFT JOIN hospitals h ON h.id = a.hospital_id
     LEFT JOIN vehicle_models vm ON vm.id = v.model_id
  WHERE a.org_id = my_org_id() AND (a.status <> 'conclusa'::assignment_status OR a.completed_at > (now() - '02:00:00'::interval));
