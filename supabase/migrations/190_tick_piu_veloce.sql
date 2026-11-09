-- 190: il sito rallentava sempre di piu': il tick (ogni 30 s) durava ~7 secondi.
-- 1) resolve_races ordinava TUTTE le assegnazioni mai fatte (70.000+, +4.000 al giorno) a ogni giro:
--    ora solo quelle dei servizi con mezzi ancora in viaggio o sul posto (stesso risultato).
-- 2) auto_dispatch_org: per ogni mezzo libero controllava ogni servizio vicino contro ogni altro mezzo libero
--    (oltre un milione di distanze al minuto) e ricalcolava i presidi 13.000 volte.
--    Ora: presidi calcolati una volta per mezzo; i servizi si guardano dal piu' vicino e ci si ferma al primo
--    valido, quindi il controllo "c'e' un mio mezzo piu' vicino?" si fa su pochissimi servizi. Stesse regole.
-- Generata da scratchpad/perf.js a partire dalle funzioni in uso.

CREATE OR REPLACE FUNCTION public.resolve_races()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare l record; pos geography; sf numeric; b bases; r jsonb; outr jsonb; i int; p jsonb; t_back timestamptz; n int := 0;
        lost_orgs uuid[] := '{}'; og uuid;
begin
  for l in
    with ranked as (
      -- tutti i mezzi (anche quelli di supporto): restano solo i primi arrivati fino ai posti del servizio
      select x.*, row_number() over (partition by x.mission_id order by x.arrives_at, x.assigned_at) rk, mm.slots_total
        from mission_assignments x join missions mm on mm.id = x.mission_id
       where x.status <> 'annullata' and x.companion_of is null
         and mm.event_ends_at is null
         -- (migr. 190) solo i servizi che hanno ancora mezzi in viaggio o sul posto
         and x.mission_id in (select z.mission_id from mission_assignments z where z.status in ('in_viaggio', 'sul_posto'))
         and exists (select 1 from mission_assignments y where y.mission_id = x.mission_id
                       and y.status <> 'annullata' and y.arrives_at <= now())
    )
    select a.* from mission_assignments a
     where a.status in ('in_viaggio', 'sul_posto') and (a.id in (select r0.id from ranked r0 where r0.rk > r0.slots_total and r0.status in ('in_viaggio', 'sul_posto'))
        -- automedica arrivata per prima: tutti i mezzi delle altre associazioni rientrano
        or (a.status in ('in_viaggio', 'sul_posto') and a.org_id is distinct from automedica_lock_org(a.mission_id)
            and automedica_lock_org(a.mission_id) is not null)
        -- ambulanza che andava a dare il cambio a un'automedica che ha perso la corsa
        or (a.companion_of is not null and a.status in ('in_viaggio', 'sul_posto')
            and exists (select 1 from mission_assignments p0 where p0.id = a.companion_of and p0.status = 'annullata')))
  loop
    if l.companion_of is null then
    insert into mission_steals (mission_id, winner_org, loser_org, code)
    select l.mission_id, w.org_id, l.org_id, (select code::text from missions where id = l.mission_id)
      from mission_assignments w
     where w.mission_id = l.mission_id and w.org_id <> l.org_id and w.status <> 'annullata' and not w.support
       and w.assigned_at > l.assigned_at and w.arrives_at <= now()
    on conflict do nothing;
    end if;

    pos := vehicle_position(l.vehicle_id, null);
    select * into b from bases where id = l.base_id;
    sf := (select vm.speed_factor from vehicle_models vm join vehicles v on v.model_id = vm.id where v.id = l.vehicle_id);
    if pos is null then pos := b.location; end if;
    r := l.route; outr := '[]';
    if r is not null then
      for i in 0 .. jsonb_array_length(r) - 1 loop
        p := r->i;
        exit when (p->>'t')::timestamptz > now();
        outr := outr || jsonb_build_array(p);
      end loop;
    end if;
    t_back := now() + make_interval(secs => leg_minutes(pos, b.location, 40 * coalesce(sf, 1)) * 60 * 0.75);
    if exists (select 1 from vehicles v join vehicle_models vm on vm.id = v.model_id where v.id = l.vehicle_id and vm.boat) then
      -- barca: torna all'ormeggio per mare, mai per strada
      outr := outr || jsonb_build_array(route_point(pos, now(), 'Rotta'))
              || sea_route_points(sea_path(pos, (select coalesce(moor_location, b.location) from vehicles where id = l.vehicle_id)), now(),
                                  7 * 0.75 / coalesce(sf, 1), 'Ormeggio', 20);
    else
      outr := outr || jsonb_build_array(route_point(pos, now(), 'Servizio perso'), route_point(b.location, t_back, 'Sede'));
    end if;
    update mission_assignments set status = 'annullata', completes_at = now(), completed_at = now(), reward_funds = 0, route = outr
     where id = l.id;
    update vehicles set status = 'disponibile' where id = l.vehicle_id and status = 'in_servizio';
    update card_inventory set state = 'attiva'
     where state = 'in_servizio' and id in (select card_id from assignment_crew where assignment_id = l.id);
    if not l.org_id = any(lost_orgs) then lost_orgs := lost_orgs || l.org_id; end if;
    n := n + 1;
  end loop;

  update mission_assignments a set support = false
   where a.support and a.companion_of is null and a.status in ('in_viaggio', 'sul_posto')
     and exists (select 1 from mission_assignments y where y.mission_id = a.mission_id and y.status <> 'annullata' and y.arrives_at <= now())
     and (select count(*) from mission_assignments z where z.mission_id = a.mission_id and z.status <> 'annullata')
         <= (select slots_total from missions where id = a.mission_id);

  -- modalità automatica: chi ha perso la corsa riparte subito su un altro servizio libero
  foreach og in array lost_orgs loop
    if (select auto_enabled from organizations where id = og) then
      begin
        null; -- ci pensa il giro ogni 10 secondi
      exception when others then null;
      end;
    end if;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.auto_dispatch_org(p_only uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  o record; v record; m record; c record; crew uuid[]; a mission_assignments;
  need_drv int; need_adv int; need_base int; adv_drv int; picked int; extra int;
  free_cnt int; v_mid uuid; n int := 0; got boolean; drivers int; cost int; v_rid uuid; free_v int; need_d int; need_r int; resc int;
begin
  perform set_config('app.in_auto', '1', true);
  create temp table if not exists _auto_free (
    rid uuid, id uuid, model_id uuid, base_id uuid, bloc geography, vpos geography, certification certification,
    equipment text[], provides text[], transfer_only boolean, transport_only boolean, electric boolean, range_left numeric, sf numeric, used boolean default false
  ) on commit drop;

  for o in select * from organizations where auto_enabled and cardinality(auto_codes) > 0 and cardinality(auto_base_ids) > 0 and auto_paid_until > now() and (p_only is null or id = p_only) loop
    -- una sola elaborazione per associazione alla volta (evita blocchi e doppioni)
    continue when not pg_try_advisory_xact_lock(hashtext('auto_dispatch'), hashtext(o.id::text));


    -- officina automatica per le ambulanze troppo usurate, ferme in sede
    for v in select vv.* from vehicles vv
              where vv.org_id = o.id and vv.status = 'disponibile' and vv.wear >= 80 and vehicle_borrower(vv.id) is null and vv.base_id = any(o.auto_base_ids)
                and not exists (select 1 from mission_assignments x where x.vehicle_id = vv.id
                                  and coalesce((x.route->-1->>'t')::timestamptz, x.completes_at) > now())
    loop
      cost := round(v.wear * v.value_score * 2);
      perform set_config('app.money_reason', 'Officina (automatica)', true);
      update organizations set funds = funds - cost where id = o.id and funds >= cost;
      if found then
        update vehicles set status = 'manutenzione', maintenance_until = now() + make_interval(mins => greatest(2, round(v.wear * 0.12))::int) where id = v.id;
      end if;
    end loop;

    perform set_config('app.money_reason', '', true);
    -- senza autisti liberi è inutile cercare
    select count(*) into drivers from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
     where ci.org_id = o.id and ci.state = 'attiva' and coalesce(ci.role_override, vo.role) = 'autista'
       and (ci.rest_until is null or ci.rest_until <= now()) and (ci.expires_at is null or ci.expires_at > now())
       and (ci.training_until is null or ci.training_until <= now());
    -- ricarica automatica a pagamento: un equipaggio per ogni ambulanza libera
    if o.auto_refill then
      select count(*) into free_v from vehicles vv
       where vv.org_id = o.id and vv.status = 'disponibile' and vv.wear < 80 and vv.fuel_liters >= 5 and vehicle_borrower(vv.id) is null and vv.base_id = any(o.auto_base_ids);
      select count(*) into resc from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
       where ci.org_id = o.id and ci.state = 'attiva' and role_rank(coalesce(ci.role_override, vo.role)) >= 1
         and (ci.rest_until is null or ci.rest_until <= now()) and (ci.training_until is null or ci.training_until <= now());
      need_d := free_v - drivers; need_r := free_v * 2 - resc;
      for c in
        select ci.id, coalesce(ci.role_override, vo.role) as role from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
         where ci.org_id = o.id and ci.state = 'riposo' and ci.rest_until > now() and card_borrower(ci.id) is null
           and (ci.expires_at is null or ci.expires_at > now()) and (ci.training_until is null or ci.training_until <= now())
         order by (coalesce(ci.role_override, vo.role) = 'autista') desc, vo.avanzato desc, ci.rest_until desc
      loop
        exit when need_d <= 0 and need_r <= 0;
        continue when (c.role = 'autista' and need_d <= 0) or (c.role <> 'autista' and need_r <= 0);
        perform set_config('app.money_reason', 'Ricarica volontari (automatica)', true);
        update organizations set funds = funds - auto_refill_cost() where id = o.id and funds >= auto_refill_cost();
        exit when not found;
        update card_inventory set state = 'attiva', rest_until = null, energy = 100, energy_updated_at = now(), services_since_rest = 0
         where id = c.id;
        if c.role = 'autista' then need_d := need_d - 1; drivers := drivers + 1; else need_r := need_r - 1; end if;
      end loop;
    end if;
    perform set_config('app.money_reason', '', true);
    continue when drivers = 0;

    -- ambulanze libere con la posizione calcolata una volta sola
    v_rid := gen_random_uuid();
    insert into _auto_free (rid, id, model_id, base_id, bloc, vpos, certification, equipment, provides, transfer_only, transport_only, electric, range_left, sf)
    select v_rid, vv.id, vv.model_id, vv.base_id, b.location, coalesce(vehicle_position(vv.id, null), b.location),
           vv.certification, vv.equipment, vehicle_provides(vv.equipment), vm.transfer_only, vv.auto_transport_only, vm.electric,
           case when vm.electric then vv.battery_pct / 100.0 * vm.range_km else null end,
           vm.speed_factor * (1 + 0.12 * coalesce(vv.speed_level, 0))
      from vehicles vv join bases b on b.id = vv.base_id join vehicle_models vm on vm.id = vv.model_id
     where vv.org_id = o.id and vv.status = 'disponibile' and vv.wear < 80 and vv.fuel_liters >= 5 and vehicle_borrower(vv.id) is null and vv.base_id = any(o.auto_base_ids)
       and not vm.automedica and not vm.boat;
    select count(*) into free_cnt from _auto_free where _auto_free.rid = v_rid;

    for v in select * from _auto_free f0 where f0.rid = v_rid order by random() loop
      exit when free_cnt <= o.auto_reserve or drivers <= 0;

      got := false;
      if o.auto_steal_red and ('rosso' = any(o.auto_codes) or 'giallo' = any(o.auto_codes)) and not v.transfer_only and not v.transport_only then
        v_mid := null;
        select mm.id into v_mid from (
          select mm.* from missions mm
         where mm.code::text = any(o.auto_codes) and mm.code in ('rosso', 'giallo') and mm.transport is distinct from 'trasferimento'
           and mm.event_ends_at is null and mm.category not in ('grande_evento', 'mare')
           and mm.status in ('aperta', 'completa', 'in_corso')
           and v.certification >= mm.min_certification and mm.requires <@ v.provides
           and st_dwithin(v.bloc, mm.location, 20000) and st_dwithin(v.vpos, mm.location, o.auto_max_km * 1000)
           and (not v.electric or planned_km(mm.id, v.base_id) <= v.range_left)
           and not exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.status <> 'annullata' and x.arrives_at <= now())
           and (
             (mm.code = 'rosso' and mm.slots_taken < mm.slots_total
               and (select count(*) from mission_assignments x where x.mission_id = mm.id and x.org_id = o.id and x.status in ('in_viaggio', 'sul_posto')) = 1)
             or (
               not exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.org_id = o.id and x.status in ('in_viaggio', 'sul_posto'))
               and (
                 (mm.status = 'aperta' and now() between mm.opens_at and mm.expires_at and mm.slots_taken < mm.slots_total)
                 or (
                   exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.status in ('in_viaggio', 'sul_posto'))
                   and not (mm.code = 'rosso' and exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.status in ('in_viaggio', 'sul_posto')
                                    group by x.org_id having count(*) >= 2))
                   and st_distance(v.vpos, mm.location) / v.sf < (
                         select min(st_distance(coalesce(vehicle_position(x.vehicle_id, null), xb.location), mm.location)
                                    / ((select vm.speed_factor from vehicle_models vm where vm.id = xv.model_id) * (1 + 0.12 * coalesce(xv.speed_level, 0))))
                           from mission_assignments x join vehicles xv on xv.id = x.vehicle_id join bases xb on xb.id = x.base_id
                          where x.mission_id = mm.id and x.status = 'in_viaggio'))
               )))
         order by
           (mm.code = 'rosso' and exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.org_id = o.id and x.status in ('in_viaggio', 'sul_posto'))) desc,
           st_distance(v.vpos, mm.location) - case mm.code when 'rosso' then 3000 else 0 end
          offset 0) mm
         where true
           and not exists (select 1 from _auto_free f where f.rid = v_rid and not f.used and f.id <> v.id and not f.transfer_only and not f.transport_only
                             and f.certification >= mm.min_certification and mm.requires <@ f.provides
                             and st_dwithin(f.bloc, mm.location, 20000)
                             and st_distance(f.vpos, mm.location) < st_distance(v.vpos, mm.location))
         limit 1;
        if v_mid is not null then select * into m from missions where id = v_mid; end if;
        got := v_mid is not null;
      end if;

      if not got then
        v_mid := null;
        select mm.id into v_mid from (
          select mm.* from missions mm
         where mm.status = 'aperta' and now() between mm.opens_at and mm.expires_at
           and mm.slots_taken < mm.slots_total and mm.event_ends_at is null and mm.category not in ('grande_evento', 'mare')
           and (o.auto_steal_red or mm.opens_at <= now() - interval '60 seconds')
           and (case when mm.transport = 'trasferimento' then 'trasferimenti'
                     when mm.code = 'nessuno' then 'ordinari' else mm.code::text end) = any(o.auto_codes)
           and (not v.transfer_only or mm.transport = 'trasferimento') and (not v.transport_only or mm.transport = 'trasferimento' or mm.code = 'nessuno')
           and v.certification >= mm.min_certification and mm.requires <@ v.provides
           and st_dwithin(v.bloc, mm.location, 20000) and st_dwithin(v.vpos, mm.location, o.auto_max_km * 1000)
           and (not v.electric or planned_km(mm.id, v.base_id) <= v.range_left)
           and not exists (select 1 from mission_assignments x where x.mission_id = mm.id and x.org_id = o.id
                             and x.status in ('in_viaggio', 'sul_posto'))
         order by st_distance(v.vpos, mm.location) - case mm.code when 'rosso' then 3000 when 'giallo' then 1000 else 0 end
          offset 0) mm
         where true
           and not exists (select 1 from _auto_free f where f.rid = v_rid and not f.used and f.id <> v.id
                             and (not f.transfer_only or mm.transport = 'trasferimento') and (not f.transport_only or mm.transport = 'trasferimento' or mm.code = 'nessuno')
                             and f.certification >= mm.min_certification and mm.requires <@ f.provides
                             and st_dwithin(f.bloc, mm.location, 20000)
                             and st_distance(f.vpos, mm.location) < st_distance(v.vpos, mm.location))
         limit 1;
        if v_mid is not null then select * into m from missions where id = v_mid; end if;
        got := v_mid is not null;
      end if;
      continue when not got;

      need_drv := coalesce((m.required_roles->>'autista')::int, 0);
      select coalesce(sum(value::int), 0) into need_adv from jsonb_each_text(m.required_roles)
       where key <> 'autista' and role_rank(key::volunteer_role) >= 2;
      need_base := coalesce((m.required_roles->>'soccorritore_base')::int, 0);
      crew := '{}'; adv_drv := 0;

      for c in
        select ci.id, vo.avanzato from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
         where ci.org_id = o.id and ci.state = 'attiva' and coalesce(ci.role_override, vo.role) = 'autista'
           and (ci.rest_until is null or ci.rest_until <= now()) and (ci.expires_at is null or ci.expires_at > now())
           and (ci.training_until is null or ci.training_until <= now())
         order by (vo.avanzato and need_adv > 0) desc, current_energy(ci.id) desc
         limit need_drv
      loop
        crew := crew || c.id; if c.avanzato then adv_drv := adv_drv + 1; end if;
      end loop;
      continue when cardinality(crew) < need_drv;

      picked := 0;
      for c in
        select ci.id from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
         where ci.org_id = o.id and ci.state = 'attiva' and role_rank(coalesce(ci.role_override, vo.role)) >= 2
           and (ci.rest_until is null or ci.rest_until <= now()) and (ci.expires_at is null or ci.expires_at > now())
           and (ci.training_until is null or ci.training_until <= now()) and ci.id <> all(crew)
         order by ((coalesce(ci.role_override, vo.role) = 'medico') = (coalesce((m.required_roles->>'medico')::int, 0) > 0)) desc, current_energy(ci.id) desc
         limit greatest(0, need_adv - adv_drv)
      loop
        crew := crew || c.id; picked := picked + 1;
      end loop;
      continue when picked < greatest(0, need_adv - adv_drv);

      extra := greatest(0, need_adv + need_base - adv_drv - picked);
      if cardinality(crew) + extra < 2 then extra := 2 - cardinality(crew); end if;
      for c in
        select ci.id from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
         where ci.org_id = o.id and ci.state = 'attiva' and role_rank(coalesce(ci.role_override, vo.role)) >= 1
           and (ci.rest_until is null or ci.rest_until <= now()) and (ci.expires_at is null or ci.expires_at > now())
           and (ci.training_until is null or ci.training_until <= now()) and ci.id <> all(crew)
         order by role_rank(coalesce(ci.role_override, vo.role)), current_energy(ci.id) desc
         limit extra
      loop
        crew := crew || c.id;
      end loop;
      continue when cardinality(crew) < 2 or cardinality(crew) > 4;

      begin
        a := claim_mission_as(o.id, m.id, v.id, crew);
        update mission_assignments set auto = true where id = a.id;
        update _auto_free set used = true where _auto_free.rid = v_rid and _auto_free.id = v.id;
        n := n + 1; free_cnt := free_cnt - 1; drivers := drivers - need_drv;
      exception when others then
        null;
      end;
    end loop;
  end loop;
  return n;
end $function$;

-- piani di esecuzione su misura a ogni chiamata (il piano "generico" scorreva tutte le 140.000 missioni)
alter function public.auto_dispatch_org(uuid) set plan_cache_mode = force_custom_plan;

-- autonomia: si calcola solo per i mezzi elettrici (CASE garantisce l'ordine)
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n');
  s := replace(src, '(not v.electric or planned_km(mm.id, v.base_id) <= v.range_left)',
                    '(case when v.electric then planned_km(mm.id, v.base_id) <= v.range_left else true end)');
  if s <> src then execute s; end if;
end $$;
