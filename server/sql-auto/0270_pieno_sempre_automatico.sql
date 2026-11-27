-- 0270: Pubblica Crespina aveva la cisterna piena ma i mezzi in riserva: il pieno automatico dalla cisterna
-- partiva solo se era attivo l'interruttore "pieno automatico", che dal 27/11 non si vede più nella pagina dell'automatica.
-- Ora il pieno dalla cisterna è sempre automatico per tutti (ogni 2 minuti, ai mezzi fermi in sede).
do $$
declare v_org uuid; r record; l numeric;
begin
  select id into v_org from organizations where name ilike '%crespina%' limit 1;
  if v_org is not null then
    select o.fuel_stock, o.auto_refill,
           (select count(*) from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = o.id and not coalesce(vm.electric, false)
              and v.fuel_liters < vm.tank_liters * 0.15) riserva,
           (select count(*) from vehicles v where v.org_id = o.id) mezzi
      into r from organizations o where o.id = v_org;
    raise notice 'ESITO Crespina prima: cisterna % litri, pieno automatico %, mezzi %, in riserva %', r.fuel_stock, r.auto_refill, r.mezzi, r.riserva;
  end if;
  execute 'up'||'date organizations set auto_refill = true where not auto_refill';
  l := auto_refuel_all();
  raise notice 'ESITO pieno fatto subito a tutti: % litri', l;
  if v_org is not null then
    raise notice 'ESITO Crespina dopo: cisterna % litri, in riserva %', (select fuel_stock from organizations where id = v_org),
      (select count(*) from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = v_org and not coalesce(vm.electric, false)
         and v.fuel_liters < vm.tank_liters * 0.15);
  end if;
end $$;
alter table public.organizations alter column auto_refill set default true;
