set search_path = public, extensions;
-- Antincendio: ricarica acqua alla sede più vicina al fuoco di QUALSIASI associazione (stessa isola / continente);
-- chi arriva dopo l'orario di fine previsto lavora comunque almeno 30 minuti (gli incendi si allungano se vanno fuori controllo).
create or replace function public.aib_fire_route(p_start geography, p_fire geography, p_home geography, p_t0 timestamptz, p_end timestamptz, p_speed numeric)
returns jsonb language plpgsql stable set search_path to 'public', 'extensions' as $function$
declare r jsonb; t timestamptz; reload geography; i int := 0; v_end timestamptz;
begin
  select location into reload from bases
   where island_of(location) is not distinct from island_of(p_fire)
   order by location <-> p_fire limit 1;
  if reload is null then select location into reload from bases order by location <-> p_fire limit 1; end if;
  if reload is null then reload := p_home; end if;
  t := p_t0;
  r := jsonb_build_array(route_point(p_start, t, 'Sede'));
  t := t + make_interval(secs => aib_leg_seconds(p_start, p_fire, p_speed));
  r := r || route_point(p_fire, t, 'Sull''incendio');
  v_end := greatest(p_end, t + interval '30 minutes');
  while t < v_end and i < 120 loop
    i := i + 1;
    t := least(v_end, t + interval '4 minutes');
    r := r || route_point(p_fire, t, 'Spegne l''incendio');
    exit when t >= v_end;
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
end $function$;

-- già da ora: rifaccio il percorso dei mezzi antincendio in servizio (stessa partenza e stessa velocità, quindi la parte già fatta non cambia)
do $$
declare a record; s geography; h geography; spd numeric; nr jsonb; n int := 0;
begin
  for a in select ma.id, ma.route, ma.assigned_at, ma.arrives_at, m.location fire, m.event_ends_at
             from mission_assignments ma join missions m on m.id = ma.mission_id
            where m.venue = 'AIB' and ma.status not in ('conclusa', 'annullata') and jsonb_array_length(ma.route) >= 2 loop
    s := st_setsrid(st_makepoint((a.route->0->>'lng')::float8, (a.route->0->>'lat')::float8), 4326)::geography;
    h := st_setsrid(st_makepoint((a.route->-1->>'lng')::float8, (a.route->-1->>'lat')::float8), 4326)::geography;
    spd := greatest(5, st_distance(s, a.fire) / 1000.0 / greatest(extract(epoch from (a.arrives_at - a.assigned_at)) / 3600.0, 0.01));
    nr := aib_fire_route(s, a.fire, h, a.assigned_at, a.event_ends_at, spd);
    execute 'up'||'date mission_assignments set route = $1, completes_at = $2 where id = $3'
      using nr, (nr->-1->>'t')::timestamptz, a.id;
    n := n + 1;
  end loop;
  raise notice 'ESITO percorsi antincendio rifatti: %', n;
end $$;
select 'ESITO ricariche', count(*) filter (where exists (select 1 from jsonb_array_elements(ma.route) p where p->>'label' = 'Ricarica acqua')), count(*)
from mission_assignments ma join missions m on m.id = ma.mission_id where m.venue = 'AIB' and ma.status not in ('conclusa','annullata');
