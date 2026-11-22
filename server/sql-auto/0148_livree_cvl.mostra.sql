\pset pager off
select 'LIV', l.name, vm.name modello, l.image_url is not null img, (select string_agg(b.name, ', ') from bases b where b.id = any(l.base_ids)) sedi,
       cardinality(l.vehicle_ids) n_mezzi, l.updated_at
  from liveries l join vehicle_models vm on vm.id = l.model_id join organizations o on o.id = l.org_id
 where o.name ilike '%croce verde livorno%' order by vm.name, l.updated_at;
select 'USA', b.name sede, vm.name modello, v.call_sign, l.name livrea
  from vehicles v join vehicle_models vm on vm.id=v.model_id join bases b on b.id=v.base_id join organizations o on o.id=v.org_id
  left join lateral (select l.name from liveries l where l.org_id=v.org_id and l.model_id=v.model_id and l.image_url is not null
     and (case when l.vehicle_ids is not null then v.id = any(l.vehicle_ids) when l.base_ids is not null then v.base_id = any(l.base_ids) else true end)
     order by (case when l.vehicle_ids is not null then 0 when l.base_ids is not null then 1 else 2 end), l.updated_at desc limit 1) l on true
 where o.name ilike '%croce verde livorno%' and l.name is not null order by vm.name, b.name;
