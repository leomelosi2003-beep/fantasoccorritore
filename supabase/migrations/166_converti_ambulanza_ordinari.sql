-- 166: convertire un'ambulanza da emergenza in mezzo "solo ordinari" pagando (e tornare indietro gratis).

alter table vehicles add column if not exists converted_ordinaria boolean not null default false;

-- claim: un mezzo convertito vale come ordinaria (fa dimissioni/ordinari) e SOLO quelli
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  s := replace(src,
    '  if m.category = ''ordinario'' and m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and not coalesce((select ordinaria from vehicle_models where id = veh.model_id), false) then raise exception ''DIMISSIONE_NEEDS_ORDINARIA''; end if;',
    '  if m.category = ''ordinario'' and m.transport is distinct from ''trasferimento'''||E'\n'||
    '     and not (coalesce((select ordinaria from vehicle_models where id = veh.model_id), false) or veh.converted_ordinaria) then raise exception ''DIMISSIONE_NEEDS_ORDINARIA''; end if;'||E'\n'||
    '  if veh.converted_ordinaria and not (m.category = ''ordinario'' and m.transport is distinct from ''trasferimento'') then raise exception ''ORDINARIA_ONLY''; end if;');
  if s = src then raise exception 'claim_mission_as: patch conversione non applicata'; end if;
  execute s;
end $$;

-- conversione a pagamento (solo ambulanze normali, ferme in sede)
create or replace function public.set_vehicle_ordinaria(p_vehicle uuid, p_on boolean)
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare v_org uuid := my_org_id(); veh vehicles; mdl vehicle_models; fee int := 8000;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into veh from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  select * into mdl from vehicle_models where id = veh.model_id;
  if mdl.ordinaria or mdl.boat or mdl.automedica or mdl.moto or mdl.aib or mdl.transfer_only then
    raise exception 'NOT_CONVERTIBLE'; end if;
  if veh.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if p_on and not veh.converted_ordinaria then
    perform set_config('app.money_reason', 'Conversione in mezzo ordinari', true);
    update organizations set funds = funds - fee where id = v_org and funds >= fee;
    if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
    perform set_config('app.money_reason', '', true);
  end if;
  update vehicles set converted_ordinaria = p_on where id = p_vehicle;
end $fn$;
grant execute on function public.set_vehicle_ordinaria(uuid, boolean) to authenticated;

-- my_fleet.ordinaria include anche i mezzi convertiti
do $$
declare d text;
begin
  d := pg_get_viewdef('public.my_fleet'::regclass, true);
  d := regexp_replace(d, ';\s*$', '');
  d := regexp_replace(d,
    'COALESCE\(\( SELECT vm\.ordinaria[\s\S]*?\), false\) AS ordinaria',
    '(COALESCE(( SELECT vm.ordinaria FROM vehicle_models vm WHERE vm.id = v.model_id), false) OR v.converted_ordinaria) AS ordinaria');
  if position('OR v.converted_ordinaria) AS ordinaria' in d) = 0 then raise exception 'my_fleet: patch ordinaria non applicata'; end if;
  execute 'create or replace view public.my_fleet as ' || d;
end $$;
