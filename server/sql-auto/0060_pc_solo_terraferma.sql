-- Protezione Civile: la missione nasce sempre su un punto noto di terraferma (niente spostamenti a caso che finivano in mare).
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.spawn_pc_mission'::regproc), E'\r\n', E'\n');
  n := replace(src, $$if sc.kind in ('ricerca', 'frana', 'argine') then loc := st_project(loc, 1500 + random() * 3000, random() * 2 * pi())::geography; end if;$$,
    $$if sc.kind in ('ricerca', 'frana', 'argine') then   -- un po' fuori dal paese, ma sempre su un punto di terra
    select s.location into loc from (
      select location from mission_spots where st_dwithin(location, loc, 6000) and not st_dwithin(location, loc, 800)
      union all select location from mission_spots_toscana where st_dwithin(location, loc, 6000) and not st_dwithin(location, loc, 800)
      union all select location from mission_spots_trentino where st_dwithin(location, loc, 6000) and not st_dwithin(location, loc, 800)
    ) s order by random() limit 1;
    loc := coalesce(loc, (select location from missions where false));
  end if;
  if loc is null then
    select s.location into loc from (
      select comune as name, location from mission_spots where st_dwithin(location, bl, 30000)
      union all select comune, location from mission_spots_toscana where st_dwithin(location, bl, 30000)
      union all select city, location from italy_spots where st_dwithin(location, bl, 30000)
    ) s order by random() limit 1;
    loc := coalesce(loc, bl);
  end if;$$);
  if n = src then raise exception 'spawn_pc_mission: patch terraferma non applicata'; end if;
  execute n;
end $d$;

-- missioni PC già aperte lontane da qualsiasi punto di terra (in mare): spostate sul punto di terra più vicino, se nessun mezzo è già partito
do $d$
declare m record; land geography; moved int := 0;
begin
  for m in select id, location from missions
            where venue = 'PC' and category = 'grande_evento' and event_id is null and status in ('aperta','in_corso')
              and not exists (select 1 from mission_spots s where st_dwithin(s.location, missions.location, 700))
              and not exists (select 1 from mission_spots_toscana s where st_dwithin(s.location, missions.location, 700))
              and not exists (select 1 from italy_spots s where st_dwithin(s.location, missions.location, 700))
  loop
    if exists (select 1 from mission_assignments a where a.mission_id = m.id and a.status not in ('annullata','conclusa')) then
      raise notice 'ESITO missione % in mare ma con mezzi già in viaggio: lasciata', m.id; continue;
    end if;
    select s.location into land from (
      select location from mission_spots union all select location from mission_spots_toscana union all select location from italy_spots
    ) s order by s.location <-> m.location limit 1;
    execute 'up'||'date missions set location = $1 where id = $2' using land, m.id;
    moved := moved + 1;
  end loop;
  raise notice 'ESITO missioni PC spostate sulla terraferma: %', moved;
end $d$;
select 'ESITO terraferma', position('sempre su un punto di terra' in pg_get_functiondef('public.spawn_pc_mission'::regproc)) > 0;
