\pset pager off
select 'ORG', id, name from organizations where name ilike '%riparbella%';
select 'VEH', v.call_sign, vm.name, v.certification, v.status, v.issue_open, v.service_km, vm.ordinaria, v.converted_ordinaria, v.long_emergency, vm.transfer_only
 from vehicles v join vehicle_models vm on vm.id=v.model_id join organizations o on o.id=v.org_id where o.name ilike '%riparbella%';
select 'CARD', coalesce(ci.role_override, vo.role) role, vo.avanzato, ci.state, count(*) from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id join organizations o on o.id=ci.org_id
 where o.name ilike '%riparbella%' group by 2,3,4 order by 2,3,4;
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where i < 116 or i between 153 and 200;
