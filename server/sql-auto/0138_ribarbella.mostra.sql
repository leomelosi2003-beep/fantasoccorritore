\pset pager off
select 'VEH', v.call_sign, v.equipment, vehicle_provides(v.equipment) prov, v.odometer_km - v.service_km km_rev, v.battery_pct, b.name, b.rent_debt, b.rented
 from vehicles v join bases b on b.id=v.base_id join organizations o on o.id=v.org_id where o.name ilike '%ribarb%';
select 'CARD', coalesce(ci.role_override, vo.role) role, ci.role_override, vo.avanzato, ci.state, (ci.rest_until > now()) riposo, (ci.training_until > now()) corso, count(*)
 from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id join organizations o on o.id=ci.org_id
 where o.name ilike '%ribarb%' group by 2,3,4,5,6,7 order by 2,3,4,5;
select 'REQ', m.required_roles::text, m.requires, m.min_certification, count(*) from missions m where m.status='aperta' and m.source='scheduler'
 and st_dwithin(m.location, (select b.location from bases b join organizations o on o.id=b.org_id where o.name ilike '%ribarb%' order by b.is_headquarters desc limit 1), 25000) group by 2,3,4;
select 'AUTO', o.auto_enabled, o.auto_codes, o.auto_base_ids, o.auto_paid_until > now() from organizations o where o.name ilike '%ribarb%';
