-- Prezzi realistici: Orionis è l'allestitore top (più caro e più redditizio).
update vehicle_models set base_cost = 33000, description = 'Robusto ed economico, un po'' lento.' where name = 'R-Masteron';
update vehicle_models set base_cost = 38000, description = 'Il classico equilibrato: va bene per tutto.' where name = 'F-Ducalis';
update vehicle_models set base_cost = 47000, description = 'Veloce e affidabile, ma costa di più.' where name = 'M-Sprinterix';

update builders set cost = 22000, value_score = 55, reliability = 0, durability = 5,
  certification = 'trasporto', bonus = '{}',
  description = 'Allestimento da trasporto: dialisi, dimissioni, ordinari.' where name = 'Mafra Allestimenti';
update builders set cost = 38000, value_score = 72, reliability = 6, durability = 8,
  certification = 'base', bonus = '{"reward_mult":0.05}',
  description = 'Omologato per emergenza: codici verdi e gialli. Ricompense +5%.' where name = 'Alexis';
update builders set cost = 58000, value_score = 95, reliability = 12, durability = 15,
  certification = 'avanzata_rianimazione', bonus = '{"reward_mult":0.15}',
  description = 'Il top: mezzo di rianimazione, anche codici rossi. Ricompense +15%.' where name = 'Orionis';

-- Fondi iniziali e ricompense in scala con i prezzi reali
alter table organizations alter column funds set default 100000;
update organizations set funds = funds + 75000;
update missions set reward_funds = reward_funds * 5 where status = 'aperta';

create or replace function generate_missions() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  open_count int; to_create int; i int; n int := 0;
  night boolean := extract(hour from now() at time zone 'Europe/Rome') >= 22
                or extract(hour from now() at time zone 'Europe/Rome') < 6;
  r numeric; t record; z record;
begin
  select count(*) into open_count from missions where status = 'aperta' and expires_at > now();
  to_create := least(3, 25 - open_count);
  if to_create <= 0 then return 0; end if;

  for i in 1..to_create loop
    -- Scelta pesata del tipo di servizio (di notte più emergenze)
    r := random() * case when night then 9 else 13 end;
    select * into t from (
      select v.*, sum(case when night then v.w_night else v.w_day end)
               over (order by v.title) as cum
      from (values
      -- categoria, codice, titolo, slot, ruoli, cert, durata, fatica, premio, ttl, peso_giorno, peso_notte
      ('ordinario'::mission_category, 'nessuno'::mission_code, 'Trasporto dialisi', 1,
        '{"autista":1,"soccorritore_base":1}'::jsonb, 'trasporto'::certification, 60, 10, 1500, 30, 4, 1),
      ('ordinario', 'nessuno', 'Dimissione ospedaliera', 1,
        '{"autista":1,"soccorritore_base":1}', 'trasporto', 45, 8, 1200, 30, 3, 0),
      ('emergenza_118', 'verde', 'Caduta in casa', 1,
        '{"autista":1,"soccorritore_base":1}', 'base', 40, 12, 2200, 8, 3, 3),
      ('emergenza_118', 'giallo', 'Dolore toracico', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'base', 50, 20, 4000, 5, 2, 3),
      ('emergenza_118', 'rosso', 'Arresto cardiaco', 2,
        '{"autista":1,"soccorritore_avanzato":1,"caposervizio":1}', 'avanzata_rianimazione', 60, 32, 7500, 3, 1, 2)
      ) as v(cat, code, title, slots, roles, cert, dur, fat, reward, ttl, w_day, w_night)
    ) s
    where s.cum >= r and (case when night then s.w_night else s.w_day end) > 0
    order by s.cum limit 1;

    -- Zona casuale di Livorno e dintorni, con ±1,5 km di scostamento
    select * into z from (values
      ('Livorno Centro', 43.5485, 10.3106), ('Livorno Nord', 43.5720, 10.3250),
      ('Ardenza', 43.5180, 10.3200),        ('Montenero', 43.4930, 10.3550),
      ('Collesalvetti', 43.5900, 10.4750),  ('Stagno', 43.6000, 10.3900)
    ) as zz(name, lat, lng) order by random() limit 1;

    insert into missions (category, code, title, location, slots_total, required_roles,
                          min_certification, duration_minutes, base_fatigue, reward_funds,
                          reward_reputation, expires_at, source)
    values (t.cat, t.code, t.title || ' — ' || z.name,
            st_setsrid(st_makepoint(z.lng + (random() - 0.5) * 0.027,
                                    z.lat + (random() - 0.5) * 0.027), 4326)::geography,
            t.slots, t.roles, t.cert, t.dur, t.fat, t.reward,
            case when t.code = 'rosso' then 5 else 1 end,
            now() + interval '5 minutes', 'scheduler');  -- tutti i servizi scadono dopo 5 minuti
    n := n + 1;
  end loop;
  return n;
end $$;
