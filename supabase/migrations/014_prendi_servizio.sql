-- PRENDI SERVIZIO: gerarchia dei ruoli, massimo 4 persone a bordo, vista delle mie missioni in corso.

-- Gerarchia: un caposervizio può fare da soccorritore avanzato o base, un avanzato da base.
create or replace function role_rank(r volunteer_role) returns int
language sql immutable as $$
  select case r when 'soccorritore_base' then 1 when 'soccorritore_avanzato' then 2 when 'caposervizio' then 3 else 0 end
$$;

create or replace function claim_mission(p_mission_id uuid, p_vehicle_id uuid, p_card_ids uuid[])
returns mission_assignments
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id();
  m missions; veh vehicles; b bases; card record; a mission_assignments;
  n_autisti int := 0; ranks int[] := '{}'; need int; have int; k int;
  dist_km numeric; speed_kmh numeric; travel_min numeric; v_slot smallint;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if coalesce(cardinality(p_card_ids), 0) = 0 then raise exception 'NO_CREW'; end if;
  if cardinality(p_card_ids) > 4 then raise exception 'TOO_MANY_CREW'; end if;
  if (select count(distinct x) from unnest(p_card_ids) x) <> cardinality(p_card_ids) then raise exception 'INVALID_CARDS'; end if;

  select * into veh from vehicles where id = p_vehicle_id and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if veh.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if veh.wear >= 80 then raise exception 'VEHICLE_NEEDS_MAINTENANCE'; end if;

  select * into m from missions where id = p_mission_id;
  if not found then raise exception 'MISSION_FULL_OR_CLOSED'; end if;
  if veh.certification < m.min_certification then raise exception 'CERTIFICATION_TOO_LOW'; end if;
  if not (m.requires <@ vehicle_provides(veh.equipment)) then
    raise exception 'MISSING_EQUIPMENT:%', array_to_string(m.requires, ','); end if;
  if exists (select 1 from mission_assignments where mission_id = m.id and org_id = v_org) then
    raise exception 'ALREADY_ON_MISSION'; end if;

  for card in
    select ci.*, vo.role, vo.id as vol_id
    from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
    where ci.id = any(p_card_ids) and ci.org_id = v_org
    order by ci.id
    for update of ci
  loop
    if card.state = 'scaduta' or (card.expires_at is not null and card.expires_at <= now()) then
      raise exception 'CARD_EXPIRED:%', card.id; end if;
    if card.state = 'in_servizio' then raise exception 'CARD_BUSY:%', card.id; end if;
    if card.rest_until is not null and card.rest_until > now() then
      raise exception 'CARD_RESTING:%', card.id; end if;
    if current_energy(card.id) < mission_fatigue(m.id, card.vol_id, now()) then
      raise exception 'CARD_TOO_TIRED:%', card.id; end if;
    if card.role = 'autista' then n_autisti := n_autisti + 1;
    else ranks := ranks || role_rank(card.role); end if;
  end loop;

  if (select count(*) from card_inventory where id = any(p_card_ids) and org_id = v_org)
     <> cardinality(p_card_ids) then raise exception 'INVALID_CARDS'; end if;

  -- autisti
  if n_autisti < coalesce((m.required_roles->>'autista')::int, 0) then raise exception 'MISSING_ROLE:autista'; end if;
  -- soccorritori con gerarchia: per ogni livello k, chi ha grado >= k deve coprire i posti di grado >= k
  for k in reverse 3..1 loop
    select coalesce(sum(value::int), 0) into need from jsonb_each_text(m.required_roles)
     where key <> 'autista' and role_rank(key::volunteer_role) >= k;
    select count(*) into have from unnest(ranks) x where x >= k;
    if have < need then
      raise exception 'MISSING_ROLE:%', case k when 3 then 'caposervizio' when 2 then 'soccorritore_avanzato' else 'soccorritore_base' end;
    end if;
  end loop;

  -- presa dello slot: atomica, primo che arriva
  update missions
     set slots_taken = slots_taken + 1,
         status = case when slots_taken + 1 = slots_total then 'completa' else status end
   where id = p_mission_id and status = 'aperta'
     and now() between opens_at and expires_at and slots_taken < slots_total
  returning slots_taken into v_slot;
  if v_slot is null then raise exception 'MISSION_FULL_OR_CLOSED'; end if;

  select * into b from bases where id = veh.base_id;
  dist_km := st_distance(b.location, m.location) / 1000.0;
  speed_kmh := (case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end)
               * (select speed_factor from vehicle_models where id = veh.model_id);
  travel_min := greatest(3, dist_km / speed_kmh * 60);

  insert into mission_assignments (mission_id, org_id, vehicle_id, base_id, slot_number,
                                   distance_km, arrives_at, completes_at)
  values (m.id, v_org, veh.id, b.id, v_slot, round(dist_km, 2),
          now() + make_interval(secs => travel_min * 60),
          now() + make_interval(secs => (travel_min + m.duration_minutes) * 60))
  returning * into a;

  insert into assignment_crew (assignment_id, card_id, role)
  select a.id, ci.id, vo.role
  from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
  where ci.id = any(p_card_ids);

  update card_inventory
     set energy = current_energy(id), energy_updated_at = now(), state = 'in_servizio'
   where id = any(p_card_ids);

  update vehicles set status = 'in_servizio' where id = veh.id;
  return a;
end $$;
grant execute on function claim_mission(uuid, uuid, uuid[]) to authenticated;

-- Stima del viaggio dalla sede del mezzo (per mostrarla prima di partire)
create or replace function travel_estimate(p_mission_id uuid, p_vehicle_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'km', round((st_distance(b.location, m.location) / 1000.0)::numeric, 1),
    'minutes', round(greatest(3, (st_distance(b.location, m.location) / 1000.0)
                / ((case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end) * vm.speed_factor) * 60)::numeric))
  from missions m, vehicles v join bases b on b.id = v.base_id join vehicle_models vm on vm.id = v.model_id
  where m.id = p_mission_id and v.id = p_vehicle_id and v.org_id = my_org_id()
$$;
grant execute on function travel_estimate(uuid, uuid) to authenticated;

-- Le mie missioni (in corso e appena concluse) con le coordinate per animare l'ambulanza
create or replace view my_assignments with (security_invoker = true) as
select a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.completed_at, a.reward_funds, a.distance_km,
       m.title, m.code, m.reward_funds as base_reward, v.call_sign,
       st_y(b.location::geometry) as base_lat, st_x(b.location::geometry) as base_lng,
       st_y(m.location::geometry) as lat, st_x(m.location::geometry) as lng
from mission_assignments a
join missions m on m.id = a.mission_id
join vehicles v on v.id = a.vehicle_id
join bases b on b.id = a.base_id
where a.org_id = my_org_id()
  and (a.status <> 'conclusa' or a.completed_at > now() - interval '2 hours');
grant select on my_assignments to authenticated;
