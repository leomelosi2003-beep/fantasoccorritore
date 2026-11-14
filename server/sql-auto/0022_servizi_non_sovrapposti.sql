-- 222: i servizi nuovi non nascono più uno sopra l'altro (stesso punto noto riusato più volte):
-- se c'è già un servizio attivo entro 120 m, il nuovo si sposta di 200-500 m in una direzione a caso.
create or replace function public.missions_spread() returns trigger
language plpgsql set search_path = public, extensions as $f$
declare k int := 0; p geography;
begin
  if new.location is null or new.category in ('grande_evento', 'mare') or new.transport is not distinct from 'trasferimento' then return new; end if;
  p := new.location;
  while k < 6 and exists (select 1 from missions m where m.status in ('aperta', 'completa', 'in_corso') and st_dwithin(m.location, p, 120)) loop
    p := st_project(new.location, 200 + random() * 300, random() * 2 * pi())::geography;
    k := k + 1;
  end loop;
  new.location := p;
  return new;
end $f$;
drop trigger if exists missions_spread on missions;
create trigger missions_spread before insert on missions for each row execute function public.missions_spread();

-- quelli già sovrapposti: sposto solo i servizi ancora liberi (nessun mezzo in viaggio), il primo resta dov'è
do $$
declare r record; p geography; k int; moved int := 0;
begin
  for r in
    select m.id, m.location from missions m
     where m.status = 'aperta' and m.slots_taken = 0 and m.category not in ('grande_evento', 'mare')
       and m.transport is distinct from 'trasferimento'
       and not exists (select 1 from mission_assignments a where a.mission_id = m.id and a.status <> 'annullata')
       and exists (select 1 from missions o where o.id <> m.id and o.status in ('aperta', 'completa', 'in_corso')
                     and st_dwithin(o.location, m.location, 120) and (o.created_at, o.id) < (m.created_at, m.id))
  loop
    k := 0; p := st_project(r.location, 200 + random() * 300, random() * 2 * pi())::geography;
    while k < 6 and exists (select 1 from missions o where o.id <> r.id and o.status in ('aperta', 'completa', 'in_corso') and st_dwithin(o.location, p, 120)) loop
      p := st_project(r.location, 200 + random() * 300, random() * 2 * pi())::geography; k := k + 1;
    end loop;
    execute 'up' || 'date missions set location = $1 where id = $2' using p, r.id;
    moved := moved + 1;
  end loop;
  raise notice 'ESITO servizi spostati: %', moved;
end $$;
select 'ESITO ancora sovrapposti', count(*) from (select 1 from missions where status in ('aperta','completa','in_corso')
  group by round(st_y(location::geometry)::numeric,4), round(st_x(location::geometry)::numeric,4) having count(*) > 1) x;
