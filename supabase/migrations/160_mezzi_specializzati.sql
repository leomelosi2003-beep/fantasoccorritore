-- 160: specializzazione dei mezzi.
-- - trasferimenti (transport='trasferimento'): SOLO passi lunghi (vehicle_models.transfer_only)
-- - dimissioni / ordinari (category='ordinario' non trasferimento): SOLO macchine "ordinarie" (nuovo flag)
-- - le macchine ordinarie costano meno e non montano presidi da emergenza (certificazione 'trasporto')

-- 1) nuovo flag + modelli ordinari (economici, senza presidi)
alter table vehicle_models add column if not exists ordinaria boolean not null default false;

insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
                            tank_liters, consumption_l100, electric, range_km, ordinaria)
select * from (values
  ('C-Civix', 14000, 0.98::numeric, 72::smallint, 66::smallint, '/vehicles/v-transporto.png',
   'Macchina per dimissioni e trasporti ordinari: economica, niente presidi da emergenza.',
   55::smallint, 7.0::numeric, false, null::smallint, true),
  ('C-Civix E', 16000, 0.98, 72, 66, '/vehicles/v-transporto-e.png',
   '⚡ Elettrica per dimissioni e trasporti ordinari: economica, niente presidi da emergenza.',
   0, 0, true, 110::smallint, true)
) v(name, base_cost, speed_factor, base_reliability, base_durability, image_url, description,
    tank_liters, consumption_l100, electric, range_km, ordinaria)
where not exists (select 1 from vehicle_models m where m.name = v.name);

-- 2) regole di accesso ai servizi
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  src2 := replace(src,
    '  -- mezzi a passo lungo: solo trasferimenti'||E'\n'||
    '  if m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and (select transfer_only from vehicle_models where id = veh.model_id) then raise exception ''TRANSFER_ONLY''; end if;',
    '  -- mezzi a passo lungo: solo trasferimenti'||E'\n'||
    '  if m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and (select transfer_only from vehicle_models where id = veh.model_id) then raise exception ''TRANSFER_ONLY''; end if;'||E'\n'||
    '  -- i trasferimenti li fanno solo i passi lunghi'||E'\n'||
    '  if m.transport = ''trasferimento'''||E'\n'||
    '     and not coalesce((select transfer_only from vehicle_models where id = veh.model_id), false) then raise exception ''TRANSFER_NEEDS_LONG''; end if;'||E'\n'||
    '  -- dimissioni / ordinari: solo macchine ordinarie'||E'\n'||
    '  if m.category = ''ordinario'' and m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and not coalesce((select ordinaria from vehicle_models where id = veh.model_id), false) then raise exception ''DIMISSIONE_NEEDS_ORDINARIA''; end if;');
  if src2 = src then raise exception 'claim_mission_as: patch non applicata'; end if;
  execute src2;
end $$;

-- 3) acquisto: le ordinarie montano solo la barella, niente monitor/presidi da emergenza
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.buy_vehicle'::regproc), E'\r\n', E'\n');
  src2 := src;
  src2 := replace(src2,
    '  if mdl.automedica or mdl.boat then'||E'\n'||
    '    p_equipment := array(select c from unnest(coalesce(p_equipment, ''{}'')) c where c not in (select code from equipment where slot = ''barella''));'||E'\n'||
    '  end if;',
    '  if mdl.automedica or mdl.boat then'||E'\n'||
    '    p_equipment := array(select c from unnest(coalesce(p_equipment, ''{}'')) c where c not in (select code from equipment where slot = ''barella''));'||E'\n'||
    '  end if;'||E'\n'||
    '  -- macchine ordinarie: niente presidi da emergenza, solo la barella'||E'\n'||
    '  if mdl.ordinaria then p_equipment := array[''barella_std'']; end if;');
  src2 := replace(src2,
    '  if n_mon <> 1 then raise exception ''NEED_ONE_MONITOR''; end if;',
    '  if n_mon <> 1 and not mdl.ordinaria then raise exception ''NEED_ONE_MONITOR''; end if;');
  if src2 = src then raise exception 'buy_vehicle: patch non applicata'; end if;
  execute src2;
end $$;

-- 160b: espone il flag 'ordinaria' nella vista my_fleet (per il controllo lato web).
do $$
declare d text;
begin
  d := pg_get_viewdef('public.my_fleet'::regclass, true);
  d := regexp_replace(d, ';\s*$', '');
  if position('AS ordinaria' in d) = 0 then
    d := replace(d,
      E'AS moor_lng\n   FROM vehicles v',
      E'AS moor_lng,\n    COALESCE(( SELECT vm.ordinaria FROM vehicle_models vm WHERE vm.id = v.model_id), false) AS ordinaria\n   FROM vehicles v');
    if position('AS ordinaria' in d) = 0 then raise exception 'my_fleet: punto di innesto non trovato'; end if;
    execute 'create or replace view public.my_fleet as ' || d;
  end if;
end $$;
