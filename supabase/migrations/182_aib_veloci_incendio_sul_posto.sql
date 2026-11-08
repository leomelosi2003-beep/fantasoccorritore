-- 182: Incendi boschivi
-- 1) I mezzi AIB vanno veloci come un'ambulanza base senza miglioramenti.
--    Le ambulanze hanno il viaggio "compresso" (arrivo in ~1 minuto, ~250 km/h di gioco); gli AIB no
--    (gli incendi sono eventi lunghi, esclusi dalla compressione) e andavano a 60 km/h con minimo 3 minuti a tratta.
--    Ora: 250 km/h x fattore velocita' del modello (e i suoi miglioramenti), minimo 30 secondi a tratta.
-- 2) L'incendio cala (o resta sotto controllo) solo coi mezzi AIB davvero SUL POSTO in quel momento
--    (entro 300 m dal fuoco): chi e' in viaggio o sta ricaricando l'acqua non conta.

create or replace function public.aib_leg_seconds(a geography, b geography, kmh numeric)
returns numeric language sql immutable as $$
  select greatest(30, st_distance(a, b) / 1000.0 / greatest(kmh, 1) * 3600)
$$;

create or replace function public.aib_fire_route(p_start geography, p_fire geography, p_home geography, p_t0 timestamptz, p_end timestamptz, p_speed numeric)
returns jsonb language plpgsql stable set search_path to 'public', 'extensions' as $$
declare r jsonb; t timestamptz; reload geography; i int := 0;
begin
  select location into reload from bases order by st_distance(location, p_fire) limit 1;
  if reload is null then reload := p_home; end if;
  t := p_t0;
  r := jsonb_build_array(route_point(p_start, t, 'Sede'));
  t := t + make_interval(secs => aib_leg_seconds(p_start, p_fire, p_speed));
  r := r || route_point(p_fire, t, 'Sull''incendio');
  while t < p_end and i < 120 loop
    i := i + 1;
    t := least(p_end, t + interval '4 minutes');
    r := r || route_point(p_fire, t, 'Spegne l''incendio');
    exit when t >= p_end;
    t := t + make_interval(secs => aib_leg_seconds(p_fire, reload, p_speed));
    r := r || route_point(reload, t, 'Ricarica acqua');
    t := t + interval '2 minutes';
    r := r || route_point(reload, t, 'Ricarica acqua');
    t := t + make_interval(secs => aib_leg_seconds(reload, p_fire, p_speed));
    r := r || route_point(p_fire, t, 'Sull''incendio');
  end loop;
  t := t + make_interval(secs => aib_leg_seconds(p_fire, p_home, p_speed));
  r := r || route_point(p_home, t, 'Sede');
  return r;
end $$;

-- claim: velocita' AIB = 250 km/h x sf (sf = fattore del modello x miglioramenti x abilita')
do $$
declare src text;
  old_call text := 'aib_fire_route(v_start, m.location, b.location, t0, m.event_ends_at, v_em)';
  new_call text := 'aib_fire_route(v_start, m.location, b.location, t0, m.event_ends_at, 250 * sf)';
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position(new_call in src) = 0 then
    if position(old_call in src) = 0 then raise exception 'claim_mission_as: chiamata aib_fire_route non trovata'; end if;
    execute replace(src, old_call, new_call);
  end if;
end $$;

-- propagazione: contano solo gli AIB sul posto; a incendio spento rientrano veloci
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.spread_wildfires'::regproc), E'\r\n', E'\n');
  s := replace(src,
    E'where a.mission_id = f.mission_id and vm.aib and a.status in (''in_viaggio'',''sul_posto'');',
    E'where a.mission_id = f.mission_id and vm.aib and a.status in (''in_viaggio'',''sul_posto'')\n' ||
    E'       and st_dwithin(vehicle_position(a.vehicle_id, null), (select location from missions where id = f.mission_id), 300);');
  s := replace(s,
    E'route_point(b.location, now() + make_interval(secs => round(leg_minutes(vehicle_position(a.vehicle_id, b.location), b.location, 45) * 60)), ''Sede'')),\n' ||
    E'        completes_at = now() + make_interval(secs => round(leg_minutes(vehicle_position(a.vehicle_id, b.location), b.location, 45) * 60))',
    E'route_point(b.location, now() + make_interval(secs => aib_leg_seconds(vehicle_position(a.vehicle_id, b.location), b.location, 250)), ''Sede'')),\n' ||
    E'        completes_at = now() + make_interval(secs => aib_leg_seconds(vehicle_position(a.vehicle_id, b.location), b.location, 250))');
  if (length(s) - length(replace(s, 'aib_leg_seconds', ''))) / length('aib_leg_seconds') <> 2
     or position('st_dwithin(vehicle_position' in s) = 0 then
    raise exception 'spread_wildfires: patch non applicata';
  end if;
  execute s;
end $$;
