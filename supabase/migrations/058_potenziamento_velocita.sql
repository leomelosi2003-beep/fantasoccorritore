-- POTENZIAMENTO VELOCITÀ dell'ambulanza (Garage): 3 livelli.
-- Ogni livello: +12% di velocità in strada e -12% di tempo sul posto. Costi: 6.000 / 12.000 / 24.000 €.
alter table vehicles add column if not exists speed_level smallint not null default 0 check (speed_level between 0 and 3);

create or replace function speed_upgrade_cost(lvl int) returns int language sql immutable as $$
  select case lvl when 0 then 6000 when 1 then 12000 when 2 then 24000 end $$;

create or replace function upgrade_vehicle_speed(p_vehicle uuid) returns vehicles
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v vehicles; cost int;
begin
  select * into v from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v.speed_level >= 3 then raise exception 'MAX_LEVEL'; end if;
  cost := speed_upgrade_cost(v.speed_level);
  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update vehicles set speed_level = speed_level + 1 where id = v.id returning * into v;
  return v;
end $$;
grant execute on function upgrade_vehicle_speed(uuid) to authenticated;

do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('speed_level' in src) = 0 then
    src := replace(src, 'sf := (select speed_factor from vehicle_models where id = veh.model_id);',
      'sf := (select speed_factor from vehicle_models where id = veh.model_id) * (1 + 0.12 * veh.speed_level);');
    src := replace(src, 'scene_min := scene_minutes(m);',
      'scene_min := greatest(3, round(scene_minutes(m) * (1 - 0.12 * veh.speed_level)))::int;');
    execute src;
  end if;

  src := pg_get_functiondef('travel_estimate(uuid,uuid)'::regprocedure);
  if position('speed_level' in src) = 0 then
    src := replace(src, 'vm.speed_factor', 'vm.speed_factor * (1 + 0.12 * v.speed_level)');
    execute src;
  end if;
end $do$;

select position('speed_level' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 servizio_ok,
       position('speed_level' in pg_get_functiondef('travel_estimate(uuid,uuid)'::regprocedure)) > 0 stima_ok;
