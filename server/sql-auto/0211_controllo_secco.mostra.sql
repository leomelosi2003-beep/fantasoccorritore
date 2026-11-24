\pset pager off
select 'DRY', o.auto_refill, count(*) filter (where v.fuel_liters < 5), count(*), count(distinct o.id)
  from vehicles v join organizations o on o.id = v.org_id join vehicle_models vm on vm.id = v.model_id
 where not coalesce(vm.electric, false) and not coalesce(vm.boat, false) and o.fuel_stock > 200 group by o.auto_refill;
