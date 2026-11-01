-- Meno servizi in generale, con PICCHI durante il giorno (fine mattina e tardo pomeriggio) e pochi di notte.
-- Codici: i verdi sono i più frequenti, poi i gialli, i rossi sono rari.
create or replace function generate_missions() returns integer
language plpgsql security definer set search_path = public, extensions as $function$
declare
  open_count int; to_create int; i int; n int := 0; nb int; cap int; mult numeric;
  h int := extract(hour from now() at time zone 'Europe/Rome');
  night boolean := h >= 22 or h < 6;
  r numeric; t record; z record; total numeric;
begin
  -- andamento della giornata: picchi alle 11-13 e alle 17-20
  mult := case when h < 6 then 0.35 when h < 8 then 0.6 when h < 11 then 1.0 when h < 13 then 1.3
               when h < 15 then 0.8 when h < 17 then 1.0 when h < 20 then 1.4 when h < 22 then 0.8 else 0.5 end;
  select count(*) into nb from bases;
  select count(*) into open_count from missions where status = 'aperta' and expires_at > now();
  cap := round((6 + 2 * nb) * mult);
  to_create := least(greatest(1, round((1 + nb / 3.0) * mult))::int, cap - open_count);
  if to_create <= 0 then return 0; end if;

  for i in 1..to_create loop
    select * into t from (
      select v.*, sum(case when night then v.w_night else v.w_day end) over (order by v.title) as cum,
             sum(case when night then v.w_night else v.w_day end) over () as tot
      from (values
      ('ordinario'::mission_category, 'nessuno'::mission_code, 'Trasporto dialisi', 1,
        '{"autista":1,"soccorritore_base":1}'::jsonb, 'trasporto'::certification, 60, 10, 1500, '{}'::text[], 4.0, 0.0),
      ('ordinario', 'nessuno', 'Dimissione ospedaliera', 1,
        '{"autista":1,"soccorritore_base":1}', 'trasporto', 45, 8, 1200, '{}', 3.0, 0.0),
      -- VERDI: i più frequenti
      ('emergenza_118', 'verde', 'Caduta in casa', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 12, 2200, '{}', 6.0, 4.0),
      ('emergenza_118', 'verde', 'Frattura arto', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 40, 12, 2500, '{steccobende}', 4.0, 2.0),
      -- GIALLI: meno dei verdi
      ('emergenza_118', 'giallo', 'Malore', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 45, 16, 3000, '{}', 2.0, 2.0),
      ('emergenza_118', 'giallo', 'Dolore toracico (ECG)', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 50, 20, 5000, '{ecg}', 2.0, 1.0),
      ('emergenza_118', 'giallo', 'Trauma pediatrico', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 50, 20, 4500, '{spinale_ped,collare}', 1.0, 0.3),
      ('emergenza_118', 'giallo', 'Caduta dall''alto', 1,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 55, 22, 4500, '{cucchiaio}', 1.0, 0.7),
      -- ROSSI: rari
      ('emergenza_118', 'rosso', 'Incidente stradale', 2,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 28, 6000, '{spinale,collare}', 1.0, 0.8),
      ('emergenza_118', 'rosso', 'Incidente con incastrato', 2,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 75, 34, 8500, '{ked,collare}', 0.4, 0.3),
      ('emergenza_118', 'rosso', 'Arresto cardiaco', 2,
        '{"autista":1,"soccorritore_avanzato":2}', 'avanzata_rianimazione', 60, 32, 7500, '{defib}', 0.6, 0.5)
      ) as v(cat, code, title, slots, roles, cert, dur, fat, reward, req, w_day, w_night)
    ) s
    where s.cum >= (select random()) * s.tot and (case when night then s.w_night else s.w_day end) > 0
    order by s.cum limit 1;

    z := null;
    -- 3 volte su 4 vicino a una sede a caso (entro 10 km), altrimenti ovunque
    select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
      from mission_spots ms where (select random()) < 0.75 and st_dwithin(ms.location, (select location from bases order by random() limit 1), 10000)
     order by random() limit 1;
    if z.name is null then
      select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
        from mission_spots offset floor(random() * (select count(*) from mission_spots)) limit 1;
    end if;

    insert into missions (category, code, title, location, slots_total, required_roles,
                          min_certification, duration_minutes, base_fatigue, reward_funds,
                          reward_reputation, requires, expires_at, source)
    values (t.cat, t.code, t.title || ' — ' || z.name,
            st_setsrid(st_makepoint(z.lng, z.lat), 4326)::geography,
            t.slots, t.roles, t.cert, t.dur, t.fat, t.reward,
            case when t.code = 'rosso' then 5 else 1 end, t.req,
            now() + interval '5 minutes', 'scheduler');
    n := n + 1;
  end loop;
  return n;
end $function$;
