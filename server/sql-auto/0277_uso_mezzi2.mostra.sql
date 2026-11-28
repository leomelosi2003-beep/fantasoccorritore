\pset pager off
do $$
declare src text; m text;
begin
  src := pg_get_functiondef((select oid from pg_proc where proname = 'claim_mission_as' order by oid desc limit 1));
  for m in select (regexp_matches(src, '([^\n]*(?:ORDINARIA|converted_ordinaria|long_emergency|transfer_only|TRANSFER_NEEDS|v_ordinaria)[^\n]*)', 'g'))[1] loop raise notice 'CLAIM %', left(m, 400); end loop;
  src := pg_get_functiondef((select oid from pg_proc where proname = 'auto_dispatch_org' order by oid desc limit 1));
  for m in select (regexp_matches(src, '([^\n]*(?:ordinaria|converted_ordinaria|long_emergency|transfer_only)[^\n]*)', 'g'))[1] loop raise notice 'AUTO %', left(m, 400); end loop;
end $$;
select 'mezzi per uso', coalesce(vm.ordinaria,false), v.converted_ordinaria, vm.transfer_only, v.long_emergency, count(*)
  from vehicles v join vehicle_models vm on vm.id = v.model_id group by 1,2,3,4,5 order by 6 desc;
