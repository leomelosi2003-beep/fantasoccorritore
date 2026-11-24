-- Pieno automatico dalla cisterna: prima si faceva solo nel momento in cui finiva il servizio,
-- ma lì il mezzo non era ancora "disponibile" e restava a secco in sede. Ora si controlla ogni 2 minuti.
create or replace function public.auto_refuel_all() returns numeric
 language sql security definer set search_path to 'public' as $$
  select coalesce(sum(refuel_org_vehicles(o.id, null, 1)), 0)
    from organizations o
   where o.auto_refill and o.fuel_stock > 0
     and exists (select 1 from vehicles v join vehicle_models vm on vm.id = v.model_id
                  where v.org_id = o.id and v.status in ('disponibile', 'manutenzione') and not coalesce(vm.electric, false)
                    and v.fuel_liters < vm.tank_liters)
$$;
do $$ declare l numeric; begin
  l := auto_refuel_all();
  raise notice 'ESITO pieno fatto subito: % litri dalle cisterne', l;
end $$;
