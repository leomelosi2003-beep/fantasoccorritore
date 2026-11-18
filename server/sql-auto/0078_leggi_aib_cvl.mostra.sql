-- stato dei mezzi antincendio di Croce Verde Livorno (solo lettura)
select 'AIB', v.call_sign, v.status, round(v.fuel_liters::numeric,1) gasolio, round(v.wear::numeric) usura, v.odometer_km - v.service_km km_da_revisione,
       v.issue_open guasto, v.maintenance_until > now() in_officina,
       (select a.completes_at::time(0) || ' fine ' || (a.route->-1->>'t')::timestamptz::time(0) || ' ' || a.status from mission_assignments a where a.vehicle_id = v.id order by a.assigned_at desc limit 1) ultimo
from vehicles v join vehicle_models vm on vm.id = v.model_id
where v.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06' and vm.aib order by v.call_sign;
select 'ORA', now()::time(0);
