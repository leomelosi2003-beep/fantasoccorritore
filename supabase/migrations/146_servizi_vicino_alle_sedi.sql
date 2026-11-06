-- Servizi molto più leggeri: nascono solo entro 50 km da una sede, pochi alla volta.
-- Prima: fino a (30 + 4 x sedi) servizi aperti in tutta Italia (~400, ~700 nuovi ogni 10 minuti).
-- Ora:   al massimo ~40 aperti (5 + sedi/2, tetto 40, x fascia oraria), pochi nuovi ogni 2 minuti.
-- Si sceglie prima un'associazione a caso e poi una sua sede, così anche chi ha una sola sede riceve servizi.
-- Quando nasce una sede nuova riceve subito 3 servizi vicini.
-- Invariati: servizi in mare (max 5), trasferimenti (max 6), eventi. I servizi già esistenti non vengono toccati.

-- crea p_count servizi entro 50 km dalla sede p_base
create or replace function public.generate_missions_near(p_base uuid, p_count int)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  h int := extract(hour from now() at time zone 'Europe/Rome');
  night boolean := h >= 22 or h < 6;
  t record; bl geography; bname text; zname text; zloc geography; n int := 0;
begin
  select location, name into bl, bname from bases where id = p_base;
  if bl is null then return 0; end if;

  for i in 1 .. greatest(0, least(coalesce(p_count, 0), 10)) loop
    select * into t from (
      select v.*, sum(case when night then v.w_night else v.w_day end) over (order by v.title) as cum,
             sum(case when night then v.w_night else v.w_day end) over () as tot
      from (values
      ('ordinario'::mission_category, 'nessuno'::mission_code, 'Trasporto dialisi', 1,
        '{"autista":1,"soccorritore_base":1}'::jsonb, 'trasporto'::certification, 60, 10, 1500, '{}'::text[], 4.0, 0.0),
      ('ordinario', 'nessuno', 'Dimissione ospedaliera', 1,
        '{"autista":1,"soccorritore_base":1}', 'trasporto', 45, 8, 1200, '{}', 3.0, 0.0),
      ('emergenza_118', 'verde', 'Caduta in casa', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 12, 2200, '{}', 7.5, 5.0),
      ('emergenza_118', 'verde', 'Frattura arto', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 12, 2500, '{steccobende}', 5.5, 3.0),
      ('emergenza_118', 'giallo', 'Malore', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 45, 16, 3000, '{}', 2.0, 2.0),
      ('emergenza_118', 'giallo', 'Dolore toracico (ECG)', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 50, 20, 5000, '{ecg}', 2.0, 1.0),
      ('emergenza_118', 'giallo', 'Trauma pediatrico', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 50, 20, 4500, '{spinale_ped,collare}', 1.0, 0.3),
      ('emergenza_118', 'giallo', 'Caduta dall''alto', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 55, 22, 4500, '{cucchiaio}', 1.0, 0.7),
      ('emergenza_118', 'rosso', 'Incidente stradale, 2 feriti', 2,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 28, 6000, '{spinale,collare}', 2.5, 2.0),
      ('emergenza_118', 'rosso', 'Incidente con incastrato, 2 feriti', 2,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 75, 34, 8500, '{ked,collare}', 1.0, 0.7),
      ('emergenza_118', 'rosso', 'Arresto cardiaco', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 32, 7500, '{defib}', 1.5, 1.2),
      ('emergenza_118', 'rosso', 'Ictus (codice stroke)', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 30, 7000, '{defib}', 0.6, 0.4),
      ('emergenza_118', 'rosso', 'Politrauma da moto', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 70, 34, 8000, '{spinale,collare}', 0.5, 0.3),
      ('emergenza_118', 'rosso', 'Insufficienza respiratoria', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 30, 6500, '{}', 0.5, 0.5),
      ('emergenza_118', 'rosso', 'Ustione grave', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 65, 32, 7000, '{}', 0.3, 0.2),
      ('emergenza_118', 'rosso', 'Shock anafilattico', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 55, 28, 6500, '{defib}', 0.4, 0.3),
      ('emergenza_118', 'giallo', 'Crisi convulsiva', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 45, 16, 3200, '{}', 1.0, 0.8),
      ('emergenza_118', 'giallo', 'Difficoltà respiratoria', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 45, 16, 3300, '{}', 1.0, 0.8),
      ('emergenza_118', 'giallo', 'Investimento pedone', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 55, 22, 4800, '{spinale,collare}', 0.8, 0.4),
      ('emergenza_118', 'giallo', 'Crisi ipoglicemica', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 14, 2900, '{}', 0.6, 0.5),
      ('emergenza_118', 'giallo', 'Dolore addominale acuto', 1, '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 14, 3000, '{}', 0.8, 0.5)
      ) as v(cat, code, title, slots, roles, cert, dur, fat, reward, req, w_day, w_night)
    ) s
    where s.cum >= (select random()) * s.tot and (case when night then s.w_night else s.w_day end) > 0
    order by s.cum limit 1;

    -- un punto vero (via, paese) entro 50 km dalla sede
    select s.name, s.location into zname, zloc from (
      select comune as name, location from mission_spots where st_dwithin(location, bl, 50000)
      union all
      select comune, location from mission_spots_toscana where st_dwithin(location, bl, 50000)
      union all
      select comune, location from mission_spots_trentino where st_dwithin(location, bl, 50000)
      union all
      select city, location from italy_spots where st_dwithin(location, bl, 50000)
    ) s order by random() limit 1;
    if not found then
      -- nessun punto conosciuto vicino: un punto a caso entro 5 km dalla sede
      zname := bname;
      zloc := st_project(bl, 500 + random() * 4500, random() * 2 * pi());
    end if;

    insert into missions (category, code, title, location, slots_total, required_roles,
                          min_certification, duration_minutes, base_fatigue, reward_funds,
                          reward_reputation, requires, expires_at, source)
    values (t.cat, t.code, t.title || ' — ' || zname, zloc,
            t.slots, t.roles, t.cert, t.dur, t.fat, t.reward,
            case when t.code = 'rosso' then 5 else 1 end, t.req,
            now() + interval '5 minutes', 'scheduler');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.generate_missions_near(uuid, int) from public, anon, authenticated;

-- giro del motore ogni 2 minuti: pochi servizi nuovi, sempre vicino a una sede
create or replace function public.generate_missions()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  h int := extract(hour from now() at time zone 'Europe/Rome');
  mult numeric; nb int; open_count int; cap int; to_create int; v_base uuid; n int := 0;
begin
  mult := case when h < 6 then 0.6 when h < 8 then 0.8 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.9 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.9 else 0.7 end;
  select count(*) into nb from bases;
  if nb = 0 then return 0; end if;
  select count(*) into open_count from missions
   where status = 'aperta' and expires_at > now() and source = 'scheduler'
     and category <> 'mare' and transport is distinct from 'trasferimento';
  cap := round(least(40, 5 + nb / 2.0) * mult);
  to_create := least(cap - open_count, greatest(2, round(nb / 8.0))::int);
  if to_create <= 0 then return 0; end if;

  for i in 1 .. to_create loop
    -- prima un'associazione a caso, poi una sua sede: ogni giocatore ha le stesse possibilità
    select b.id into v_base from bases b
     where b.org_id = (select org_id from bases group by org_id order by random() limit 1)
     order by random() limit 1;
    n := n + generate_missions_near(v_base, 1);
  end loop;
  return n;
end $$;

-- sede nuova: subito qualche servizio nei dintorni
create or replace function public.bases_new_missions()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
begin
  begin
    perform generate_missions_near(new.id, 3);
  exception when others then
    raise warning 'servizi per la sede nuova non creati: %', sqlerrm; -- la sede si crea comunque
  end;
  return null;
end $$;
drop trigger if exists bases_new_missions on public.bases;
create trigger bases_new_missions after insert on public.bases
  for each row execute function public.bases_new_missions();
