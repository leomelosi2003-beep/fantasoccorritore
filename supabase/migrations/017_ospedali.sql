-- OSPEDALI: ogni servizio diventa un percorso sede → posto → ospedale → sede.
create table if not exists hospitals (
  id           uuid primary key default gen_random_uuid(),
  name         text unique not null,
  location     geography(Point, 4326) not null,
  capabilities text[] not null default '{ps}'   -- ps, cardio, trauma_maggiore, pediatria, dialisi
);
alter table hospitals enable row level security;
drop policy if exists "read hospitals" on hospitals;
create policy "read hospitals" on hospitals for select using (true);
drop policy if exists "admin hospitals" on hospitals;
create policy "admin hospitals" on hospitals for all to authenticated using (is_admin()) with check (is_admin());
grant select on hospitals to anon, authenticated;
grant insert, update, delete on hospitals to authenticated;

insert into hospitals (name, location, capabilities) values
  ('Ospedale di Livorno',        st_setsrid(st_makepoint(10.3236, 43.5562), 4326)::geography, '{ps,cardio,pediatria,dialisi}'),
  ('Ospedale di Cisanello (Pisa)', st_setsrid(st_makepoint(10.4294, 43.7058), 4326)::geography, '{ps,cardio,trauma_maggiore,pediatria,dialisi}'),
  ('Ospedale di Cecina',         st_setsrid(st_makepoint(10.5182, 43.3141), 4326)::geography, '{ps,dialisi}')
on conflict (name) do nothing;

create or replace view hospitals_map with (security_invoker = true) as
select id, name, capabilities, st_y(location::geometry) as lat, st_x(location::geometry) as lng from hospitals;
grant select on hospitals_map to anon, authenticated;

-- Tipo di trasporto del servizio
alter table missions add column if not exists transport text;
alter table mission_assignments add column if not exists hospital_id uuid references hospitals(id);
alter table mission_assignments add column if not exists route jsonb;

create or replace function set_mission_transport() returns trigger
language plpgsql as $$
begin
  if new.transport is null and new.category <> 'grande_evento' then
    new.transport := case
      when new.title like 'Trasporto dialisi%'        then 'dialisi'
      when new.title like 'Dimissione%'               then 'dimissione'
      when new.title like 'Incidente con incastrato%' then 'trauma_maggiore'
      when new.title like 'Dolore toracico%' or new.title like 'Arresto cardiaco%' then 'cardio'
      when new.title like 'Trauma pediatrico%'        then 'pediatria'
      else 'ps' end;
  end if;
  return new;
end $$;
drop trigger if exists missions_transport on missions;
create trigger missions_transport before insert on missions for each row execute function set_mission_transport();

-- Ospedale più vicino con la specialità richiesta
create or replace function nearest_hospital(p_point geography, p_need text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from hospitals
  where capabilities @> array[case when p_need in ('dimissione') or p_need is null then 'ps' else p_need end]
  order by st_distance(location, p_point) limit 1
$$;

-- Minuti di viaggio tra due punti
create or replace function leg_minutes(a geography, b geography, kmh numeric) returns numeric
language sql immutable as $$ select greatest(3, st_distance(a, b) / 1000.0 / kmh * 60) $$;

create or replace function route_point(p geography, t timestamptz, label text) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_object('lat', st_y(p::geometry), 'lng', st_x(p::geometry), 't', t, 'label', label)
$$;

-- Prendi servizio: ora calcola anche l'ospedale e tutto il percorso
create or replace function claim_mission(p_mission_id uuid, p_vehicle_id uuid, p_card_ids uuid[])
returns mission_assignments
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id();
  m missions; veh vehicles; b bases; card record; a mission_assignments; h hospitals;
  n_autisti int := 0; ranks int[] := '{}'; need int; have int; k int;
  sf numeric; v_em numeric; v_back numeric; scene_min int; t0 timestamptz; t1 timestamptz; t2 timestamptz;
  t3 timestamptz; t4 timestamptz; t5 timestamptz; v_route jsonb; v_slot smallint; dist_km numeric;
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

  if n_autisti < coalesce((m.required_roles->>'autista')::int, 0) then raise exception 'MISSING_ROLE:autista'; end if;
  for k in reverse 3..1 loop
    select coalesce(sum(value::int), 0) into need from jsonb_each_text(m.required_roles)
     where key <> 'autista' and role_rank(key::volunteer_role) >= k;
    select count(*) into have from unnest(ranks) x where x >= k;
    if have < need then
      raise exception 'MISSING_ROLE:%', case k when 3 then 'caposervizio' when 2 then 'soccorritore_avanzato' else 'soccorritore_base' end;
    end if;
  end loop;

  update missions
     set slots_taken = slots_taken + 1,
         status = case when slots_taken + 1 = slots_total then 'completa' else status end
   where id = p_mission_id and status = 'aperta'
     and now() between opens_at and expires_at and slots_taken < slots_total
  returning slots_taken into v_slot;
  if v_slot is null then raise exception 'MISSION_FULL_OR_CLOSED'; end if;

  -- ===== percorso =====
  select * into b from bases where id = veh.base_id;
  sf := (select speed_factor from vehicle_models where id = veh.model_id);
  v_em := (case m.code when 'rosso' then 60 when 'giallo' then 50 else 40 end) * sf;
  v_back := 40 * sf;
  scene_min := case m.code when 'rosso' then 25 when 'giallo' then 20 when 'verde' then 15 else 10 end;
  t0 := now();

  if m.event_ends_at is not null or m.transport is null then
    -- postazione o servizio senza ospedale: sede → posto → sede
    t1 := t0 + make_interval(secs => leg_minutes(b.location, m.location, v_em) * 60);
    t2 := greatest(t1 + make_interval(mins => case when m.event_ends_at is null then m.duration_minutes else 0 end),
                   coalesce(m.event_ends_at + interval '15 minutes', t1));
    t3 := t2 + make_interval(secs => leg_minutes(m.location, b.location, v_back) * 60);
    v_route := jsonb_build_array(route_point(b.location, t0, 'Sede'), route_point(m.location, t1, 'Sul posto'),
                                 route_point(m.location, t2, 'Sul posto'), route_point(b.location, t3, 'Sede'));
    t5 := t3;
  else
    select * into h from hospitals where id = nearest_hospital(m.location, m.transport);
    if m.transport = 'dimissione' then
      -- sede → ospedale (carico) → casa → sede
      t1 := t0 + make_interval(secs => leg_minutes(b.location, h.location, v_back) * 60);
      t2 := t1 + interval '10 minutes';
      t3 := t2 + make_interval(secs => leg_minutes(h.location, m.location, v_back) * 60);
      t4 := t3 + interval '10 minutes';
      t5 := t4 + make_interval(secs => leg_minutes(m.location, b.location, v_back) * 60);
      v_route := jsonb_build_array(route_point(b.location, t0, 'Sede'), route_point(h.location, t1, h.name),
                                   route_point(h.location, t2, h.name), route_point(m.location, t3, 'A casa del paziente'),
                                   route_point(m.location, t4, 'A casa del paziente'), route_point(b.location, t5, 'Sede'));
    else
      -- sede → posto (soccorso) → ospedale (consegna) → sede
      t1 := t0 + make_interval(secs => leg_minutes(b.location, m.location, v_em) * 60);
      t2 := t1 + make_interval(mins => scene_min);
      t3 := t2 + make_interval(secs => leg_minutes(m.location, h.location, v_em) * 60);
      t4 := t3 + case when m.transport = 'dialisi' then interval '10 minutes' else interval '15 minutes' end;
      t5 := t4 + make_interval(secs => leg_minutes(h.location, b.location, v_back) * 60);
      v_route := jsonb_build_array(route_point(b.location, t0, 'Sede'), route_point(m.location, t1, 'Sul posto'),
                                   route_point(m.location, t2, 'Sul posto'), route_point(h.location, t3, h.name),
                                   route_point(h.location, t4, h.name), route_point(b.location, t5, 'Sede'));
    end if;
  end if;
  dist_km := st_distance(b.location, m.location) / 1000.0;

  insert into mission_assignments (mission_id, org_id, vehicle_id, base_id, slot_number,
                                   distance_km, arrives_at, completes_at, hospital_id, route)
  values (m.id, v_org, veh.id, b.id, v_slot, round(dist_km, 2), t1, t5, h.id, v_route)
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

-- Le mie missioni con percorso e ospedale
drop view if exists my_assignments;
create view my_assignments with (security_invoker = true) as
select a.id, a.status, a.assigned_at, a.arrives_at, a.completes_at, a.completed_at, a.reward_funds, a.distance_km,
       a.route, h.name as hospital,
       m.title, m.code, m.reward_funds as base_reward, v.call_sign,
       st_y(b.location::geometry) as base_lat, st_x(b.location::geometry) as base_lng,
       st_y(m.location::geometry) as lat, st_x(m.location::geometry) as lng
from mission_assignments a
join missions m on m.id = a.mission_id
join vehicles v on v.id = a.vehicle_id
join bases b on b.id = a.base_id
left join hospitals h on h.id = a.hospital_id
where a.org_id = my_org_id()
  and (a.status <> 'conclusa' or a.completed_at > now() - interval '2 hours');
grant select on my_assignments to authenticated;

-- I servizi già aperti ricevono subito il tipo di trasporto
update missions set transport = case
      when title like 'Trasporto dialisi%'        then 'dialisi'
      when title like 'Dimissione%'               then 'dimissione'
      when title like 'Incidente con incastrato%' then 'trauma_maggiore'
      when title like 'Dolore toracico%' or title like 'Arresto cardiaco%' then 'cardio'
      when title like 'Trauma pediatrico%'        then 'pediatria'
      else 'ps' end
 where transport is null and category <> 'grande_evento' and status = 'aperta';

select (select count(*) from hospitals) as ospedali;
