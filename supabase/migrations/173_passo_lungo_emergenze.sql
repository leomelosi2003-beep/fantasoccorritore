-- 173: i passi lunghi possono fare anche le emergenze se l'utente attiva un toggle sul mezzo.
alter table vehicles add column if not exists long_emergency boolean not null default false;

-- toggle (solo per i passi lunghi): trasferimenti + anche emergenze
create or replace function public.set_vehicle_long_emergency(p_vehicle uuid, p_on boolean)
 returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare v_org uuid := my_org_id(); veh vehicles;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into veh from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if not coalesce((select transfer_only from vehicle_models where id = veh.model_id), false) then
    raise exception 'NOT_LONG'; end if;   -- solo i passi lunghi
  update vehicles set long_emergency = p_on where id = p_vehicle;
end $fn$;
grant execute on function public.set_vehicle_long_emergency(uuid, boolean) to authenticated;

-- claim: il passo lungo col toggle attivo può uscire anche sui servizi non-trasferimento
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  s := replace(src,
    '  if m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and (select transfer_only from vehicle_models where id = veh.model_id) then raise exception ''TRANSFER_ONLY''; end if;',
    '  if m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and (select transfer_only from vehicle_models where id = veh.model_id) and not veh.long_emergency then raise exception ''TRANSFER_ONLY''; end if;');
  if s = src then raise exception 'claim: patch TRANSFER_ONLY non applicata'; end if;
  execute s;
end $$;

-- my_fleet espone long_emergency
do $$
declare d text;
begin
  d := pg_get_viewdef('public.my_fleet'::regclass, true);
  d := regexp_replace(d, ';\s*$', '');
  if position('AS long_emergency' in d) = 0 then
    d := regexp_replace(d, 'AS aib(\s+)FROM vehicles v', 'AS aib,' || E'\n    ' || 'v.long_emergency AS long_emergency\1FROM vehicles v');
    if position('AS long_emergency' in d) = 0 then raise exception 'my_fleet: innesto long_emergency non trovato'; end if;
    execute 'create or replace view public.my_fleet as ' || d;
  end if;
end $$;
