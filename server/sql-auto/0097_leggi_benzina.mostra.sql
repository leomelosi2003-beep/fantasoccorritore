\pset pager off
select 'FN', p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and (p.proname ~* 'fuel|refuel|benzin' or pg_get_functiondef(p.oid) ~* 'fuel_(stock|liters)') order by 2;
select 'DEF', pg_get_functiondef('buy_fuel'::regproc);
select 'DEF', pg_get_functiondef('refuel'::regproc);
select 'PREZZO', * from fuel_prices;
select 'CRON', jobname, schedule, command from cron.job where command ~* 'fuel|benzin';
select 'TRG', tgname, tgrelid::regclass from pg_trigger t join pg_proc p on p.oid=t.tgfoid where p.prokind='f' and pg_get_functiondef(p.oid) ~* 'fuel_liters' and not tgisinternal;
select 'CVL', o.fuel_stock, (select count(*) from bases where org_id=o.id), (select count(*) from bases where collab_org=o.id),
  (select count(*) from vehicles v join vehicle_models m on m.id=v.model_id where v.org_id=o.id and not coalesce(m.electric,false) and v.fuel_liters < 5),
  (select count(*) from vehicles v join vehicle_models m on m.id=v.model_id where v.org_id=o.id and not coalesce(m.electric,false) and v.fuel_liters > m.tank_liters),
  (select count(*) from vehicles v where v.org_id=o.id and v.fuel_liters < 0)
  from organizations o where o.id='fa0f81c2-fea9-449a-a66f-f84325fe1d06';
select 'TUTTI', count(*) filter (where fuel_stock < 0), count(*) filter (where fuel_stock > 1000*(select count(*) from bases b where b.org_id=o.id)), max(fuel_stock) from organizations o;
select 'LEDGER', left(reason,50), sum(amount), count(*) from org_ledger where reason ~* 'gasolio|benzin|carbur|cisterna' and created_at > now()-interval '2 days' group by 2;
