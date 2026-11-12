-- 197 (12/11/2026): limite emergenze abbassato a 250.000 km; revisione generale da 200.000 km.
create or replace function public.km_limit_emergency() returns int language sql immutable as $$ select 250000 $$;
do $$ declare src text; begin
  src := pg_get_functiondef('public.overhaul_vehicle(uuid)'::regprocedure);
  if position('v_km < 200000' in src) > 0 then return; end if;
  src := replace(src, 'if v_km < 300000 and not veh.km_retired', 'if v_km < 200000 and not veh.km_retired');
  if position('v_km < 200000' in src) = 0 then raise exception 'patch non applicata'; end if;
  execute src;
end $$;
update public.vehicles set odometer_km = odometer_km where odometer_km - overhaul_km >= 250000 and not km_retired;
