-- Modalità automatica: diagnosi "perché i mezzi restano in sede" e corso per formare autisti tra i soccorritori base
-- (role_override = 'autista', già rispettato da my_cards, claim_mission_as e auto_dispatch_org). Nessun dato cancellato.
set search_path = public, extensions;

create or replace function public.driver_course_cost() returns bigint language sql immutable as $$ select 5000::bigint $$;

-- forma fino a p_n soccorritori base come autisti (prima i liberi con la guida migliore)
create or replace function public.train_drivers(p_n int)
returns int language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); f bigint; ids uuid[]; n int;
begin
  if v_org is null then raise exception 'NOT_FOUND'; end if;
  p_n := least(greatest(coalesce(p_n, 1), 1), 100);
  select array_agg(id) into ids from (
    select ci.id from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
     where ci.org_id = v_org and ci.state <> 'scaduta' and ci.role_override is null and vo.role = 'soccorritore_base'
     order by (ci.state = 'attiva') desc, vo.stat_guida desc limit p_n) x;
  n := coalesce(cardinality(ids), 0);
  if n = 0 then raise exception 'NO_CANDIDATES'; end if;
  select funds into f from organizations where id = v_org for update;
  if f < n * driver_course_cost() then raise exception 'INSUFFICIENT_FUNDS'; end if;
  perform set_config('app.money_reason', 'Corso autisti (' || n || ' volontari)', true);
  update organizations set funds = funds - n * driver_course_cost() where id = v_org;
  perform set_config('app.money_reason', '', true);
  execute 'up'||'date card_inventory set role_override = ''autista'' where id = any($1)' using ids;
  return n;
end $$;

-- un autista formato torna soccorritore (gratis)
create or replace function public.untrain_driver(p_card uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  execute 'up'||'date card_inventory set role_override = null where id = $1 and org_id = $2 and role_override = ''autista''' using p_card, my_org_id();
end $$;

-- perché i mezzi delle sedi in automatico restano fermi
create or replace function public.auto_diagnosis()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  with o as (select * from organizations where id = my_org_id()),
  v as (
    select v.*, vm.aib, vm.maxi, coalesce(vm.boat, false) boat, (vm.ordinaria or coalesce(v.converted_ordinaria, false)) ordin, vm.transfer_only
    from vehicles v join vehicle_models vm on vm.id = v.model_id, o
    where v.org_id = o.id and v.base_id = any(o.auto_base_ids) and v.status = 'disponibile'),
  c as (
    select coalesce(ci.role_override, vo.role)::text role, ci.state from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id, o
    where ci.org_id = o.id and ci.state <> 'scaduta')
  select jsonb_build_object(
    'bases', (select cardinality(auto_base_ids) from o),
    'reserve', (select auto_reserve from o),
    'codes', (select auto_codes from o),
    'enabled', (select auto_enabled and auto_paid_until > now() from o),
    'idle', (select count(*) from v),
    'idle_special', (select count(*) from v where aib or maxi or boat),
    'idle_ordinarie', (select count(*) from v where ordin and not (aib or maxi or boat)),
    'idle_transfer', (select count(*) from v where transfer_only and not ordin and not coalesce(long_emergency, false)),
    'idle_blocked', (select count(*) from v where not (aib or maxi or boat) and (wear >= 80 or issue_open or fuel_liters < 5 or odometer_km - service_km >= service_interval_km())),
    'drivers_free', (select count(*) from c where role = 'autista' and state = 'attiva'),
    'drivers_total', (select count(*) from c where role = 'autista'),
    'rescuers_free', (select count(*) from c where role in ('soccorritore_base','soccorritore_avanzato','infermiere','medico') and state = 'attiva'),
    'trainable', (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id, o
                   where ci.org_id = o.id and ci.state <> 'scaduta' and ci.role_override is null and vo.role = 'soccorritore_base'),
    'vehicles_total', (select count(*) from vehicles v2 join vehicle_models m2 on m2.id = v2.model_id, o
                        where v2.org_id = o.id and not m2.aib and not m2.maxi and not coalesce(m2.boat, false)),
    'course_cost', driver_course_cost())
$$;
grant execute on function public.train_drivers(int), public.untrain_driver(uuid), public.auto_diagnosis() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO diagnosi', to_regprocedure('public.auto_diagnosis()') is not null;
