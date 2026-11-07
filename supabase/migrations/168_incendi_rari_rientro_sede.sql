-- 168: incendi più rari e pochi; i mezzi AIB rientrano in sede a fine servizio.

-- claim: il mezzo AIB è libero solo quando è TORNATO in sede (ultimo punto della rotta)
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  s := replace(src,
    'v_free := coalesce((v_route->-2->>''t'')::timestamptz, m.event_ends_at);',
    'v_free := coalesce((v_route->-1->>''t'')::timestamptz, m.event_ends_at);');
  if s = src then raise exception 'claim: patch v_free AIB non applicata'; end if;
  execute s;
end $$;

-- spread: a incendio domato, i mezzi AIB rientrano in sede (dalla posizione attuale) e si liberano all'arrivo
create or replace function public.spread_wildfires()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare f record; n int; needed int; new_int numeric;
begin
  for f in select w.*, m.event_ends_at from wildfires w join missions m on m.id = w.mission_id
           where m.status in ('aperta','completa','in_corso') and m.event_ends_at > now() loop
    select count(*) into n from mission_assignments a
      join vehicles v on v.id = a.vehicle_id join vehicle_models vm on vm.id = v.model_id
     where a.mission_id = f.mission_id and vm.aib and a.status in ('in_viaggio','sul_posto');
    needed := f.severity + 1;
    if n >= needed then new_int := greatest(0, f.intensity - (n - needed + 1) * 6);
    else new_int := least(100, f.intensity + (needed - n) * 4); end if;
    update wildfires set intensity = new_int, updated_at = now() where mission_id = f.mission_id;

    if new_int <= 0 then
      update missions set status = 'conclusa', event_ends_at = now(), expires_at = now() where id = f.mission_id;
      update mission_assignments a set
        route = jsonb_build_array(
          route_point(vehicle_position(a.vehicle_id, b.location), now(), 'Rientro'),
          route_point(b.location, now() + make_interval(secs => round(leg_minutes(vehicle_position(a.vehicle_id, b.location), b.location, 45) * 60)), 'Sede')),
        completes_at = now() + make_interval(secs => round(leg_minutes(vehicle_position(a.vehicle_id, b.location), b.location, 45) * 60))
      from bases b
      where b.id = a.base_id and a.mission_id = f.mission_id and a.status in ('in_viaggio','sul_posto');
      continue;
    end if;

    if new_int >= 100 and f.event_ends_at < now() + interval '30 minutes' then
      update missions set event_ends_at = event_ends_at + interval '20 minutes',
                          expires_at = expires_at + interval '20 minutes'
       where id = f.mission_id and event_ends_at < now() + interval '110 minutes';
    end if;
  end loop;
end $fn$;

-- tick: incendi RARI — massimo 1 alla volta, almeno 3 ore tra uno e l'altro, bassa probabilità
create or replace function public.tick_wildfires()
returns void language plpgsql security definer set search_path to 'public','extensions' as $fn$
begin
  perform spread_wildfires();
  if (select count(*) from missions where venue='AIB' and category='grande_evento'
        and status in ('aperta','completa','in_corso') and event_ends_at > now()) = 0
     and coalesce((select max(created_at) from missions where venue='AIB' and category='grande_evento'),
                  now() - interval '1 day') < now() - interval '3 hours'
     and random() < 0.08 then
    perform spawn_wildfire();
  end if;
end $fn$;
