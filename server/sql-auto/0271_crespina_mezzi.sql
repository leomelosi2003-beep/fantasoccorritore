-- 0271: controllo dei mezzi di Pubblica Crespina (solo dati di gioco)
do $$
declare v_org uuid; r record;
begin
  select id into v_org from organizations where name ilike '%crespina%' limit 1;
  for r in select v.call_sign, vm.name model, coalesce(vm.electric, false) el, v.fuel_liters, vm.tank_liters, v.battery_pct, v.status, v.issue_open,
                  v.service_km, b.name base, v.wear
             from vehicles v join vehicle_models vm on vm.id = v.model_id left join bases b on b.id = v.base_id where v.org_id = v_org loop
    raise notice 'ESITO % | % | elettrico % | gasolio %/% | batteria % | % | guasto % | usura % | sede %',
      r.call_sign, r.model, r.el, r.fuel_liters, r.tank_liters, r.battery_pct, r.status, r.issue_open, r.wear, r.base;
  end loop;
  raise notice 'ESITO controllo gasolio nella partenza: %', (select substring(pg_get_functiondef((select oid from pg_proc where proname = 'claim_mission_as' order by oid desc limit 1))
     from '.{0,80}NO_FUEL.{0,40}'));
exception when others then raise notice 'ESITO errore: %', sqlerrm;
end $$;
