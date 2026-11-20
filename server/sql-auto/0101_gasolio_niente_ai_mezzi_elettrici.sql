-- Il pieno dalla cisterna non deve versare gasolio nei mezzi elettrici (sprecava la cisterna).
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.refuel_org_vehicles'::regproc), E'\r\n', E'\n');
  if position('coalesce(vm.electric, false)' in src) = 0 then
    src := replace(src, $$and vv.status in ('disponibile', 'manutenzione')$$, $$and vv.status in ('disponibile', 'manutenzione') and not coalesce(vm.electric, false)$$);
    if position('coalesce(vm.electric, false)' in src) = 0 then raise exception 'patch refuel non applicata'; end if;
    execute src;
  end if;
end $d$;
select 'ESITO gasolio', position('coalesce(vm.electric, false)' in pg_get_functiondef('public.refuel_org_vehicles'::regproc)) > 0;
