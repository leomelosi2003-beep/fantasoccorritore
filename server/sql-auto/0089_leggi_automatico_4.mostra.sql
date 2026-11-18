set search_path = public, extensions;
-- diagnosi modalità automatica di Croce Verde Livorno (solo lettura, dati di gioco)
select 'ORG', 1;
select 'SEDE', b.name,
  count(*) filter (where v.status = 'disponibile') liberi,
  count(*) filter (where v.status = 'in_servizio') in_servizio,
  count(*) filter (where v.status = 'disponibile' and (vm.ordinaria or v.converted_ordinaria)) liberi_ordinari,
  count(*) filter (where v.status = 'disponibile' and vm.transfer_only and not coalesce(v.long_emergency,false)) liberi_trasferimenti,
  count(*) filter (where v.status = 'disponibile' and (vm.aib or vm.maxi or coalesce(vm.boat,false))) liberi_speciali,
  count(*) filter (where v.status = 'disponibile' and (v.wear >= 80 or v.issue_open or v.fuel_liters < 5 or v.odometer_km - v.service_km >= service_interval_km())) liberi_bloccati,
  (select count(*) from missions m where m.status in ('aperta','in_corso') and m.category not in ('grande_evento') and st_dwithin(m.location, b.location, 20000)) servizi_20km,
  (select count(*) from missions m where m.status in ('aperta','in_corso') and m.category not in ('grande_evento','ordinario') and st_dwithin(m.location, b.location, 20000)) emergenze_20km
from bases b join vehicles v on v.base_id = b.id join vehicle_models vm on vm.id = v.model_id
where b.id in (select unnest(auto_base_ids) from organizations where id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06')
group by b.id, b.name order by b.name;
select 'EQUIPAGGI', vo.role, ci.state, count(*), round(avg(current_energy(ci.id))) energia
from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
where ci.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and ci.state <> 'scaduta' group by 2, 3 order by 2, 3;
select 'AUTO_FN', pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure);
select 'TICK', to_jsonb(t) from tick_state t;
