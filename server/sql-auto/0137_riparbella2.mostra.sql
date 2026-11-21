\pset pager off
select 'ORG', id, name from organizations where name ilike '%ripar%' or name ilike '%parbel%' or name ilike '%rip%socc%';
select 'VEH', o.name, v.call_sign, vm.name, v.certification, v.status, v.issue_open, v.wear, v.fuel_liters, vm.ordinaria, v.converted_ordinaria, v.long_emergency, vm.transfer_only, vm.automedica
 from vehicles v join vehicle_models vm on vm.id=v.model_id join organizations o on o.id=v.org_id where v.call_sign ilike '%india%' or o.name ilike '%ripar%';
select 'CARD', o.name, coalesce(ci.role_override, vo.role) role, ci.role_override, vo.avanzato, ci.state, count(*) from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id join organizations o on o.id=ci.org_id
 where o.name ilike '%ripar%' group by 2,3,4,5,6 order by 2,3,4,5,6;
select 'AVZ', count(*) filter (where vo.avanzato), count(*) filter (where vo.avanzato and vo.role='autista'), count(*) filter (where vo.avanzato and vo.role<>'autista') from volunteers vo;
