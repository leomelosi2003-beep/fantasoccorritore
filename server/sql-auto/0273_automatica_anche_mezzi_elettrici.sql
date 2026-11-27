-- 0273: l'automatica non mandava mai i mezzi elettrici (es. C-Civix E di Pubblica Crespina): controllava "gasolio >= 5 litri",
-- ma i mezzi elettrici hanno 0 litri. Ora per gli elettrici conta la batteria.
do $$
declare fn record; src text; new_src text; o record; ok boolean := true; err text;
  cond text := 'vv.fuel_liters >= 5';
  newcond text := '(vv.fuel_liters >= 5 or ((select coalesce(vm_e.electric, false) from vehicle_models vm_e where vm_e.id = vv.model_id) and coalesce(vv.battery_pct, 100) >= 5))';
  originals text[] := '{}';
begin
  for fn in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('auto_dispatch_org', 'auto_medical') loop
    src := replace(pg_get_functiondef(fn.oid), E'\r\n', E'\n');
    if position(cond in src) = 0 or position('vm_e.electric' in src) > 0 then continue; end if;
    originals := originals || src;
    new_src := replace(src, cond, newcond);
    execute new_src;
    raise notice 'ESITO % corretta (% punti)', fn.proname, (length(src) - length(replace(src, cond, ''))) / length(cond);
  end loop;
  -- prova su tutte le associazioni; se qualcosa si rompe rimetto com'era
  for o in select id from organizations where auto_enabled loop
    begin
      perform auto_dispatch_org(o.id);
    exception when others then ok := false; err := sqlerrm; exit;
    end;
  end loop;
  if not ok then
    for src in select unnest(originals) loop execute src; end loop;
    raise notice 'ESITO ERRORE, rimesso com''era: %', err;
  else
    raise notice 'ESITO prova su tutte le associazioni: tutto ok';
  end if;
end $$;
