-- Officina: "sistema al rientro". Il giocatore segna un mezzo (anche in servizio): appena è fermo in sede
-- il server fa da solo i lavori (guasti, revisione, pezzi consumati, gomme adatte dal magazzino, carrozzeria),
-- uno alla volta, finché non resta niente da fare. Nessun dato cancellato.
alter table vehicles add column if not exists fix_on_return boolean not null default false;
create index if not exists vehicles_fix_on_return_idx on vehicles(id) where fix_on_return;

create or replace function public.set_fix_on_return(p_vehicles uuid[], p_on boolean default true)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  execute 'up'||'date vehicles set fix_on_return = $1 where org_id = $2 and id = any($3)' using coalesce(p_on, true), v_org, p_vehicles;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.set_fix_on_return(uuid[], boolean) to authenticated;

create or replace function public.run_fix_on_return()
returns int language plpgsql security definer set search_path = public, extensions as $$
declare v record; winter boolean; md int; did boolean; n int := 0; t text; p record;
begin
  md := extract(month from now() at time zone 'Europe/Rome')::int * 100 + extract(day from now() at time zone 'Europe/Rome')::int;
  winter := md >= 1115 or md < 416;
  for v in
    select vv.id, vv.org_id, vv.odometer_km, vv.service_km, vv.tire_model_id, vv.tire_wear_km, vv.body_damage, o.owner_id,
           coalesce(vm.boat, false) boat
      from vehicles vv join organizations o on o.id = vv.org_id join vehicle_models vm on vm.id = vv.model_id
     where vv.fix_on_return and vv.status = 'disponibile'
     limit 300
  loop
    -- i lavori si fanno come li farebbe il proprietario (stessi prezzi, stessi controlli)
    perform set_config('request.jwt.claims', json_build_object('sub', v.owner_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v.owner_id::text, true);
    did := false;
    if exists (select 1 from vehicle_issues where vehicle_id = v.id and fixed_at is null) then
      begin perform repair_vehicle(v.id); did := true; exception when others then null; end;
    end if;
    if not did and not v.boat and v.odometer_km - coalesce(v.service_km, 0) >= 15000 then
      begin perform service_vehicle(v.id); did := true; exception when others then null; end;
    end if;
    if not did then
      for p in select vp.part_code from vehicle_parts vp join vehicle_part_types pt on pt.code = vp.part_code
                where vp.vehicle_id = v.id and (v.odometer_km - vp.installed_km) / nullif(pt.life_km, 0) >= 0.8 loop
        begin perform replace_part(v.id, p.part_code); did := true; exception when others then null; end;
        exit when did;
      end loop;
    end if;
    if not did and not v.boat and (v.tire_model_id is null
        or exists (select 1 from tire_models tm where tm.id = v.tire_model_id
                    and (v.tire_wear_km / nullif(tm.life_km, 0) >= 0.8
                         or (winter and tm.season = 'estiva') or (not winter and tm.season = 'invernale')))) then
      select tm.id into t from org_tire_stock s join tire_models tm on tm.id = s.tire_model_id
       where s.org_id = v.org_id and s.qty > 0 and (case when winter then tm.season <> 'estiva' else tm.season <> 'invernale' end)
       order by tm.grip desc, tm.life_km desc limit 1;
      if t is not null then
        begin perform mount_tires(v.id, t); did := true; exception when others then null; end;
      end if;
    end if;
    if not did and coalesce(v.body_damage, 0) > 0 then
      begin perform repair_body(v.id); did := true; exception when others then null; end;
    end if;
    if did then n := n + 1;
    else
      -- niente altro da fare (o mancano soldi/gomme): il mezzo torna normale
      execute 'up'||'date vehicles set fix_on_return = false where id = $1' using v.id;
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return n;
end $$;
revoke execute on function public.run_fix_on_return() from public, anon, authenticated;
notify pgrst, 'reload schema';
select 'ESITO al rientro', count(*) from vehicles where fix_on_return;
