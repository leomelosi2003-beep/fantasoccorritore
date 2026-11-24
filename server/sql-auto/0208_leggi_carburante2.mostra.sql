\pset pager off
select 'CD', i, l from regexp_split_to_table(replace(pg_get_functiondef('complete_due_assignments'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
 where l ~* 'refuel|fuel|auto_refill';
select 'DRY', o.auto_refill, count(*) filter (where v.fuel_liters < 5), count(*), count(distinct o.id)
  from vehicles v join organizations o on o.id = v.org_id join vehicle_models vm on vm.id = v.model_id
 where not coalesce(vm.electric, false) and not coalesce(vm.boat, false) and o.fuel_stock > 200 group by o.auto_refill;
select 'DRY2', v.status, count(*) from vehicles v join organizations o on o.id=v.org_id join vehicle_models vm on vm.id=v.model_id
 where not coalesce(vm.electric,false) and not coalesce(vm.boat,false) and o.fuel_stock > 200 and v.fuel_liters < 5 group by 2;
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'fuel|NO_FUEL|range';
