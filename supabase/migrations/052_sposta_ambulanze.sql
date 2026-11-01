-- Spostare un'ambulanza in un'altra delle proprie sedi (se libera, non in prestito e c'è posto)
create or replace function move_vehicle(p_vehicle uuid, p_base uuid) returns vehicles
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v vehicles; b bases; parked int;
begin
  select * into v from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.base_id = p_base then return v; end if;
  select * into b from bases where id = p_base and org_id = v_org;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if exists (select 1 from mission_assignments where vehicle_id = v.id and status <> 'conclusa' and completes_at > now()) then
    raise exception 'VEHICLE_BUSY'; end if;
  if vehicle_borrower(v.id) is not null then raise exception 'VEHICLE_LENT'; end if;
  select count(*) into parked from vehicles where base_id = b.id and status <> 'fuori_servizio';
  if parked >= b.vehicle_capacity then raise exception 'BASE_FULL'; end if;
  update vehicles set base_id = b.id where id = v.id returning * into v;
  return v;
end $$;
grant execute on function move_vehicle(uuid, uuid) to authenticated;
