-- ANNULLA VIAGGIO: prima di arrivare sul posto l'ambulanza può rinunciare al servizio ed è subito libera
-- (riparte dalla posizione in cui si trova). Il posto torna libero per gli altri per qualche minuto.
create or replace function cancel_assignment(p_assignment uuid) returns mission_assignments
language plpgsql security definer set search_path = public, extensions as $$
declare a mission_assignments; m missions; b bases; pos geography; sf numeric; r jsonb; outr jsonb := '[]'; i int; p jsonb; t_back timestamptz;
begin
  select * into a from mission_assignments where id = p_assignment and org_id = my_org_id() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'in_viaggio' or a.arrives_at <= now() then raise exception 'ALREADY_ON_SCENE'; end if;
  select * into m from missions where id = a.mission_id for update;
  select * into b from bases where id = a.base_id;
  pos := coalesce(vehicle_position(a.vehicle_id, null), b.location);
  sf := (select vm.speed_factor from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = a.vehicle_id);
  r := a.route;
  if r is not null then
    for i in 0 .. jsonb_array_length(r) - 1 loop
      p := r->i;
      exit when (p->>'t')::timestamptz > now();
      outr := outr || jsonb_build_array(p);
    end loop;
  end if;
  t_back := now() + make_interval(secs => leg_minutes(pos, b.location, 40 * coalesce(sf, 1)) * 60);
  outr := outr || jsonb_build_array(route_point(pos, now(), 'Viaggio annullato'), route_point(b.location, t_back, 'Sede'));
  update mission_assignments set status = 'annullata', completes_at = now(), completed_at = now(), reward_funds = 0, route = outr
   where id = a.id returning * into a;
  update vehicles set status = 'disponibile' where id = a.vehicle_id and status = 'in_servizio';
  update card_inventory set state = 'attiva'
   where state = 'in_servizio' and id in (select card_id from assignment_crew where assignment_id = a.id);
  if a.slot_number <= m.slots_total then
    update missions set slots_taken = greatest(0, slots_taken - 1), status = 'aperta',
           expires_at = greatest(expires_at, now() + interval '3 minutes')
     where id = m.id;
  end if;
  return a;
end $$;
grant execute on function cancel_assignment(uuid) to authenticated;

-- claim_mission: se il numero di posto è già usato da un viaggio annullato, prende il primo libero
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('slot già usato' in src) = 0 then
    src := replace(src, '  select * into b from bases where id = veh.base_id;',
'  -- slot già usato da un viaggio annullato: prende il primo numero libero
  if exists (select 1 from mission_assignments where mission_id = m.id and slot_number = v_slot) then
    select coalesce(max(slot_number), 0) + 1 into v_slot from mission_assignments where mission_id = m.id;
  end if;
  select * into b from bases where id = veh.base_id;');
    execute src;
  end if;
end $do$;
