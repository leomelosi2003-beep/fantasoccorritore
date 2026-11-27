do $$
declare src text; m text;
begin
  src := pg_get_functiondef((select oid from pg_proc where proname = 'claim_mission_as' order by oid desc limit 1));
  for m in select (regexp_matches(src, '.{0,140}fuel_liters.{0,100}', 'g'))[1] loop raise notice 'ESITO claim: %', m; end loop;
  src := pg_get_functiondef((select oid from pg_proc where proname = 'auto_dispatch_org' order by oid desc limit 1));
  for m in select (regexp_matches(src, '.{0,140}fuel_liters.{0,100}', 'g'))[1] loop raise notice 'ESITO auto: %', m; end loop;
end $$;
