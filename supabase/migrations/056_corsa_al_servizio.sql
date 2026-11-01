-- CORSA AL SERVIZIO: anche se tutti i posti sono presi, si può partire finché nessuna ambulanza è arrivata sul posto.
-- Chi arriva prima si aggiudica il servizio; le altre vengono annullate e tornano in sede (senza premio).

create or replace view missions_map with (security_invoker = true) as
select id, category, code, title, description, venue, slots_total, slots_taken, required_roles, min_certification,
       requires, reward_funds, expires_at, status, event_id, event_ends_at,
       st_y(location::geometry) as lat, st_x(location::geometry) as lng,
       (status in ('completa', 'in_corso') and event_ends_at is null
        and exists (select 1 from mission_assignments x where x.mission_id = missions.id and x.status in ('in_viaggio', 'sul_posto'))
        and not exists (select 1 from mission_assignments x where x.mission_id = missions.id and x.status <> 'annullata' and x.arrives_at <= now())
       ) as contestable,
       (select min(x.arrives_at) from mission_assignments x where x.mission_id = missions.id and x.status <> 'annullata') as first_arrival
from missions
where status in ('completa', 'in_corso') or (status = 'aperta' and expires_at > now());

-- Le ambulanze arrivate dopo i posti disponibili perdono il servizio e rientrano dalla posizione in cui si trovano
create or replace function resolve_races() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare l record; pos geography; sf numeric; b bases; r jsonb; outr jsonb; i int; p jsonb; t_back timestamptz; n int := 0;
begin
  for l in
    select a.* from (
      select x.*, row_number() over (partition by x.mission_id order by x.arrives_at, x.assigned_at) rk, mm.slots_total
        from mission_assignments x join missions mm on mm.id = x.mission_id
       where x.status <> 'annullata'
         and mm.event_ends_at is null
         and exists (select 1 from mission_assignments y where y.mission_id = x.mission_id
                       and y.status <> 'annullata' and y.arrives_at <= now())
    ) a where a.rk > a.slots_total and a.status in ('in_viaggio', 'sul_posto')
  loop
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
    t_back := now() + make_interval(secs => leg_minutes(pos, b.location, 40 * coalesce(sf, 1)) * 60);
    outr := outr || jsonb_build_array(route_point(pos, now(), 'Servizio perso'), route_point(b.location, t_back, 'Sede'));

    update mission_assignments set status = 'annullata', completes_at = now(), completed_at = now(), reward_funds = 0, route = outr
     where id = l.id;
    update vehicles set status = 'disponibile' where id = l.vehicle_id and status = 'in_servizio';
    update card_inventory set state = 'attiva'
     where state = 'in_servizio' and id in (select card_id from assignment_crew where assignment_id = l.id);
    n := n + 1;
  end loop;
  return n;
end $$;

do $do$
declare src text;
begin
  -- partire anche con i posti pieni, se nessuno è ancora arrivato
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('corsa al servizio' in src) = 0 then
    src := replace(src, '  if v_slot is null then raise exception ''MISSION_FULL_OR_CLOSED''; end if;',
'  if v_slot is null then
    -- corsa al servizio: posti pieni ma nessuna ambulanza ancora sul posto
    if m.event_ends_at is null and m.status in (''aperta'', ''completa'', ''in_corso'')
       and exists (select 1 from mission_assignments x where x.mission_id = m.id and x.status in (''in_viaggio'', ''sul_posto''))
       and not exists (select 1 from mission_assignments x where x.mission_id = m.id and x.status <> ''annullata'' and x.arrives_at <= now()) then
      select coalesce(max(slot_number), 0) + 1 into v_slot from mission_assignments where mission_id = m.id;
    else
      raise exception ''MISSION_FULL_OR_CLOSED'';
    end if;
  end if;');
    execute src;
  end if;

  -- i servizi persi vengono chiusi ogni minuto; le missioni si chiudono anche con assegnazioni annullate
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  if position('resolve_races' in src) = 0 then
    src := regexp_replace(src, '(\nbegin\n)', E'\\1  perform resolve_races();\n');
    src := replace(src, 'where x.mission_id = mm.id and x.status <> ''conclusa'')', 'where x.mission_id = mm.id and x.status not in (''conclusa'', ''annullata''))');
    execute src;
  end if;
end $do$;

select position('corsa al servizio' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as corsa_ok,
       position('perform resolve_races()' in pg_get_functiondef('complete_due_assignments()'::regprocedure)) > 0 as risolvi_ok,
       position('not in (''conclusa'', ''annullata'')' in pg_get_functiondef('complete_due_assignments()'::regprocedure)) > 0 as chiusura_ok;
