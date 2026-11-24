\pset pager off
select 'FN', p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname ~* 'fuel|refuel|carbur|benzin|ricaric|cistern' );
select 'RF', i, l from regexp_split_to_table(replace(pg_get_functiondef('refuel_org_vehicles'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'WHO', p.proname from pg_proc p where p.pronamespace='public'::regnamespace and prosrc ilike '%refuel_org_vehicles%';
select 'DRY', o.auto_refill, count(*) filter (where v.fuel_liters < 5) asciutti, count(*) n_mezzi, min(o.fuel_stock), count(distinct o.id) orgs
  from vehicles v join organizations o on o.id = v.org_id join vehicle_models vm on vm.id = v.model_id
 where not coalesce(vm.electric, false) and not coalesce(vm.boat, false) and o.fuel_stock > 200 group by 1;
select 'DRY2', v.status, count(*) from vehicles v join organizations o on o.id=v.org_id join vehicle_models vm on vm.id=v.model_id
 where not coalesce(vm.electric,false) and not coalesce(vm.boat,false) and o.fuel_stock > 200 and v.fuel_liters < 5 group by 2;
select 'CRON', jobname, schedule, command from cron.job where command ilike '%fuel%' or command ilike '%refuel%';
