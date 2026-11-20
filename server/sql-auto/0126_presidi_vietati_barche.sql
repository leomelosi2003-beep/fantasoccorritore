-- Presidi vietati per modello:
--  B-Jetto (moto d'acqua): niente cardiomonitor, massaggiatore, cucchiaio, KED, materasso, steccobende, tavole spinali (resta DAE, borsoni, collari)
--  barche (B-Marlin, B-Sprint): niente KED
-- I presidi già montati che ora sono vietati tornano nel magazzino dell'associazione (non si perde niente).
alter table vehicle_models add column if not exists banned_equipment text[] not null default '{}';
update vehicle_models set banned_equipment = '{lt15,lt35,massaggiatore,cucchiaio,ked,materasso,steccobende,spinale,spinale_ped}' where name = 'B-Jetto';
update vehicle_models set banned_equipment = '{ked}' where name in ('B-Marlin', 'B-Sprint');

-- montaggio e spostamento: controllo
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.equip_mount(uuid, text, boolean)'::regprocedure), E'\r\n', E'\n');
  if position('EQUIP_NOT_ALLOWED' in src) = 0 then
    n := replace(src, $$  if p_code = any(v.equipment) then raise exception 'ALREADY_INSTALLED'; end if;$$,
      $$  if p_code = any(v.equipment) then raise exception 'ALREADY_INSTALLED'; end if;
  if p_code = any(coalesce((select banned_equipment from vehicle_models where id = v.model_id), '{}')) then raise exception 'EQUIP_NOT_ALLOWED'; end if;$$);
    if n = src then raise exception 'equip_mount: patch non applicata'; end if;
    execute n;
  end if;
  src := replace(pg_get_functiondef('public.equip_move'::regproc), E'\r\n', E'\n');
  if position('EQUIP_NOT_ALLOWED' in src) = 0 then
    n := replace(src, $$  if p_from = p_to then raise exception 'SAME_VEHICLE'; end if;$$,
      $$  if p_from = p_to then raise exception 'SAME_VEHICLE'; end if;
  if p_code = any(coalesce((select vm.banned_equipment from vehicles vv join vehicle_models vm on vm.id = vv.model_id where vv.id = p_to), '{}')) then raise exception 'EQUIP_NOT_ALLOWED'; end if;$$);
    if n = src then raise exception 'equip_move: patch non applicata'; end if;
    execute n;
  end if;
  -- acquisto del mezzo: i presidi vietati non si montano (se manca il monitor, il DAE)
  src := replace(pg_get_functiondef('public.buy_vehicle'::regproc), E'\r\n', E'\n');
  if position('banned_equipment' in src) = 0 then
    n := replace(src, $$  if mdl.aib or mdl.maxi then p_equipment := '{}'; end if;$$,
      $$  if mdl.aib or mdl.maxi then p_equipment := '{}'; end if;
  if cardinality(coalesce(mdl.banned_equipment, '{}')) > 0 then
    p_equipment := array(select c from unnest(coalesce(p_equipment, '{}')) c where c <> all(mdl.banned_equipment));
    if not exists (select 1 from equipment where slot = 'monitor' and code = any(p_equipment)) and not ('dae' = any(mdl.banned_equipment)) then
      p_equipment := p_equipment || 'dae'::text; end if;
  end if;$$);
    if n = src then raise exception 'buy_vehicle: patch non applicata'; end if;
    execute n;
  end if;
end $d$;

-- mezzi già esistenti: i presidi vietati tornano in magazzino
do $d$
declare v record; c text; k int := 0;
begin
  for v in select vv.id, vv.org_id, vv.equipment, vm.banned_equipment from vehicles vv join vehicle_models vm on vm.id = vv.model_id
            where cardinality(vm.banned_equipment) > 0 and vv.equipment && vm.banned_equipment loop
    foreach c in array v.equipment loop
      if c = any(v.banned_equipment) then perform _equip_stock_add(v.org_id, c, 1); k := k + 1; end if;
    end loop;
    perform _equip_save(v.id, array(select x from unnest(v.equipment) x where x <> all(v.banned_equipment)));
  end loop;
  raise notice 'ESITO presidi rimessi in magazzino: %', k;
end $d$;

-- my_fleet: presidi vietati del modello (per il sito)
do $d$
declare src text; n text;
begin
  src := pg_get_viewdef('public.my_fleet'::regclass, true);
  if position('banned_equipment' in src) > 0 then return; end if;
  n := regexp_replace(src, E'\n   FROM vehicles v', E',\n    COALESCE(( SELECT vm.banned_equipment FROM vehicle_models vm WHERE vm.id = v.model_id), ''{}''::text[]) AS banned_equipment\n   FROM vehicles v');
  if n = src then raise exception 'my_fleet: patch non applicata'; end if;
  execute 'create or replace view public.my_fleet as ' || n;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO modelli', name, banned_equipment from vehicle_models where cardinality(banned_equipment) > 0;
