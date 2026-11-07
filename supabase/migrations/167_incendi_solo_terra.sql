-- 167: gli incendi nascono solo sulla terraferma (zone verdi/campagna), mai in mare.
create or replace function public.spawn_wildfire(p_sev int default null)
returns uuid language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare sev int; bl geography; bname text; loc geography; cand geography; zname text; mid uuid; hours int;
begin
  sev := coalesce(p_sev, (1 + floor(random()*3))::int);
  select b.location, b.name into bl, bname from bases b
   order by (select count(distinct b2.org_id) from bases b2 where st_dwithin(b2.location, b.location, 25000)) desc, random()
   limit 1;
  if bl is null then return null; end if;

  -- cerca un punto di terra (da un paese/via noto) spostato un po' in campagna, lontano dal mare e dai porti
  loc := null;
  for attempt in 1..14 loop
    select st_project(s.location, 700 + random()*1700, random()*2*pi()) into cand from (
      select location from mission_spots where st_dwithin(location, bl, 15000)
      union all select location from mission_spots_toscana where st_dwithin(location, bl, 15000)
      union all select location from mission_spots_trentino where st_dwithin(location, bl, 15000)
      union all select location from italy_spots where st_dwithin(location, bl, 15000)
    ) s order by random() limit 1;
    exit when cand is null;
    if not exists (select 1 from sea_spots where st_dwithin(location, cand, 1500))
       and not exists (select 1 from ports where st_dwithin(location, cand, 1200)) then
      loc := cand; exit;
    end if;
  end loop;

  -- ripiego: un punto di terra diretto (senza spostamento), lontano dal mare
  if loc is null then
    select s.location into loc from (
      select location from mission_spots where st_dwithin(location, bl, 15000)
      union all select location from mission_spots_toscana where st_dwithin(location, bl, 15000)
      union all select location from mission_spots_trentino where st_dwithin(location, bl, 15000)
      union all select location from italy_spots where st_dwithin(location, bl, 15000)
    ) s where not exists (select 1 from sea_spots where st_dwithin(sea_spots.location, s.location, 1200))
      order by random() limit 1;
  end if;
  if loc is null then return null; end if;

  select s.name into zname from (
    select comune as name, location from mission_spots where st_dwithin(location, loc, 9000)
    union all select comune, location from mission_spots_toscana where st_dwithin(location, loc, 9000)
    union all select comune, location from mission_spots_trentino where st_dwithin(location, loc, 9000)
    union all select city as name, location from italy_spots where st_dwithin(location, loc, 9000)
  ) s order by st_distance(s.location, loc) limit 1;
  zname := coalesce(zname, bname);
  hours := sev * 2;

  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', (case when sev = 1 then 'giallo' else 'rosso' end)::mission_code,
          '🔥 Incendio boschivo — ' || zname,
          'Incendio boschivo di gravità ' || sev || '/3. Possono intervenire tutti con i mezzi antincendio: più mezzi mandi, prima lo domate e più guadagnate. Se arrivano in pochi, le fiamme si propagano. Dura circa ' || hours || ' ore.',
          'AIB', loc, 999, '{"aib":2}'::jsonb, 'trasporto', hours*60, 10, 6000 + sev*4000, 6 + sev*2, '{}',
          now(), now() + make_interval(hours => hours), 'scheduler', now() + make_interval(hours => hours))
  returning id into mid;
  insert into wildfires (mission_id, severity, intensity, base_radius) values (mid, sev, sev*25, 300 + sev*150);
  return mid;
end $fn$;

-- spegni subito gli incendi attivi che sono finiti in mare (vicino ai punti mare)
update missions m set status='conclusa', event_ends_at=now(), expires_at=now()
 where m.venue='AIB' and m.category='grande_evento' and m.event_ends_at > now()
   and exists (select 1 from sea_spots s where st_dwithin(s.location, m.location, 1500));
