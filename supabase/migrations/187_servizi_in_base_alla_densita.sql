-- 187: meno servizi dove le sedi sono tante, uguale dove sono poche.
-- Problema: ogni 12 minuti nascevano ~330 servizi tutti insieme (~300 puntini sulla mappa, sito lento).
--  a) il conteggio "servizi entro 20 km" era una fotografia presa PRIMA del giro: in una zona con 40 sedi
--     vicine ognuna riceveva i suoi 4 servizi, anche se quelli appena creati per la sede accanto bastavano;
--  b) i servizi duravano tutti esattamente 12 minuti: scadevano insieme e ripartiva l'ondata.
-- Ora:
--  - obiettivo per sede = 4 + 2,5 x radice(sedi entro 20 km - 1), massimo 25
--    (sede isolata 4, 5 sedi vicine 9, 10 sedi 12, 40 sedi ~20) e il conteggio si rifa' sede per sede;
--  - durata dei servizi casuale tra 9 e 15 minuti (media 12, come prima).

create or replace function public.mission_target_for_base(p_nearby int)
returns int language sql immutable as $$
  select least(25, 4 + ceil(2.5 * sqrt(greatest(coalesce(p_nearby, 1), 1) - 1)))::int
$$;

do $$
declare src text; s text;
  old_loop text := E'  for r in\n' ||
    E'    with aperti as materialized (\n' ||
    E'      select location from missions\n' ||
    E'       where status = ''aperta'' and expires_at > now() and category <> ''mare'' and transport is distinct from ''trasferimento''\n' ||
    E'    ), conta as (\n' ||
    E'      select b.id, (select count(*) from aperti a where st_dwithin(a.location, b.location, 20000)) c from bases b\n' ||
    E'    )\n' ||
    E'    select id, 4 - c as manca from conta where c < 4 order by c, random()\n' ||
    E'  loop\n' ||
    E'    exit when budget <= 0;\n' ||
    E'    n := n + generate_missions_near(r.id, least(r.manca, budget)::int, 20000);\n' ||
    E'    budget := budget - r.manca;\n' ||
    E'  end loop;';
  new_loop text := E'  -- (migr. 187) obiettivo in base a quante sedi ci sono intorno, conteggio rifatto sede per sede\n' ||
    E'  for r in\n' ||
    E'    select b.id, b.location,\n' ||
    E'           mission_target_for_base((select count(*) from bases b2 where st_dwithin(b2.location, b.location, 20000))::int) as target\n' ||
    E'      from bases b order by random()\n' ||
    E'  loop\n' ||
    E'    exit when budget <= 0;\n' ||
    E'    select r.target - count(*) into v_need from missions\n' ||
    E'     where status = ''aperta'' and expires_at > now() and category <> ''mare'' and transport is distinct from ''trasferimento''\n' ||
    E'       and st_dwithin(location, r.location, 20000);\n' ||
    E'    if v_need > 0 then\n' ||
    E'      n := n + generate_missions_near(r.id, least(v_need, budget, 10)::int, 20000);\n' ||
    E'      budget := budget - v_need;\n' ||
    E'    end if;\n' ||
    E'  end loop;';
begin
  src := replace(pg_get_functiondef('public.generate_missions'::regproc), E'\r\n', E'\n');
  if position('migr. 187' in src) = 0 then
    s := replace(src, old_loop, new_loop);
    s := replace(s, 'budget int := 80; n int := 0;', 'budget int := 80; n int := 0; v_need int;');
    if s = src or position('v_need int' in s) = 0 then raise exception 'generate_missions: patch non applicata'; end if;
    execute s;
  end if;

  src := replace(pg_get_functiondef('public.generate_missions_near'::regproc), E'\r\n', E'\n');
  if position('9 + floor(random() * 7)' in src) = 0 then
    s := replace(src, $q$now() + interval '12 minutes', 'scheduler');$q$,
                      $q$now() + make_interval(mins => 9 + floor(random() * 7)::int), 'scheduler');$q$);
    if s = src then raise exception 'generate_missions_near: patch durata non applicata'; end if;
    execute s;
  end if;
end $$;
