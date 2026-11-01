-- Immobilizzazione: tanti presidi, montabili tutti insieme (ognuno ha il suo slot).
alter table equipment add column if not exists category text;
update equipment set category = slot where category is null;

update equipment set name = 'Tavola spinale adulti', category = 'immobilizzazione', sort = 1,
  description = 'Per traumi e incidenti stradali sugli adulti.' where code = 'spinale';

insert into equipment (code, slot, category, name, cost, provides, effects, description, sort) values
  ('spinale_ped', 'spinale_ped', 'immobilizzazione', 'Tavola spinale pediatrica', 450, '{spinale_ped}', '{}',
     'Su misura per i più piccoli: necessaria per i traumi pediatrici.', 2),
  ('collari',     'collari',     'immobilizzazione', 'Kit collari cervicali',      250, '{collare}',     '{}',
     'Tutte le misure, da neonato ad adulto. Senza collari niente incidenti.', 3),
  ('ked',         'ked',         'immobilizzazione', 'KED (estricatore)',          350, '{ked}',         '{}',
     'Per estrarre il ferito dall''auto: serve per gli incidenti con incastrato.', 4),
  ('cucchiaio',   'cucchiaio',   'immobilizzazione', 'Barella a cucchiaio (scoop)', 900, '{cucchiaio}',  '{}',
     'Si apre in due e raccoglie il paziente senza muoverlo: cadute dall''alto.', 5),
  ('materasso',   'materasso',   'immobilizzazione', 'Materasso a depressione',   1200, '{}',
     '{"reward_mult":0.10,"on_any":["spinale","spinale_ped","ked","cucchiaio"]}',
     'Il paziente viaggia come in un guscio: tutti i traumi +10%.', 6),
  ('steccobende', 'steccobende', 'immobilizzazione', 'Steccobende a depressione',  600, '{steccobende}', '{}',
     'Immobilizza braccia e gambe: serve per le fratture.', 7)
on conflict (code) do update set slot = excluded.slot, category = excluded.category, name = excluded.name,
  cost = excluded.cost, provides = excluded.provides, effects = excluded.effects,
  description = excluded.description, sort = excluded.sort;

-- Kit base del primo mezzo: anche i collari
update equipment set starter = code in ('dae','barella_std','borsoni','spinale','collari');
-- Chi aveva già la spinale riceve i collari (prima erano impliciti)
update vehicles set equipment = equipment || '{collari}'
 where 'spinale' = any(equipment) and not 'collari' = any(equipment);

-- Bonus anche su una lista di requisiti ("on_any")
create or replace function equipment_reward_mult(p_eq text[], p_code text, p_requires text[]) returns numeric
language sql stable set search_path = public, extensions as $$
  select coalesce(sum((effects->>'reward_mult')::numeric), 0) from equipment
  where code = any(p_eq) and effects ? 'reward_mult'
    and (
      (not effects ? 'on' and not effects ? 'on_any')
      or effects->>'on' = p_code or effects->>'on' = any(p_requires)
      or (effects ? 'on_any' and exists (
            select 1 from jsonb_array_elements_text(effects->'on_any') t where t = any(p_requires)))
    )
$$;

-- Generatore con i nuovi servizi di trauma
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
    r := random() * case when night then 16 else 22 end;
    select * into t from (
      select v.*, sum(case when night then v.w_night else v.w_day end) over (order by v.title) as cum
      from (values
      -- categoria, codice, titolo, slot, ruoli, cert, durata, fatica, premio, requisiti, peso_giorno, peso_notte
      ('ordinario'::mission_category, 'nessuno'::mission_code, 'Trasporto dialisi', 1,
        '{"autista":1,"soccorritore_base":1}'::jsonb, 'trasporto'::certification, 60, 10, 1500, '{}'::text[], 4, 1),
      ('ordinario', 'nessuno', 'Dimissione ospedaliera', 1,
        '{"autista":1,"soccorritore_base":1}', 'trasporto', 45, 8, 1200, '{}', 3, 0),
      ('emergenza_118', 'verde', 'Caduta in casa', 1,
        '{"autista":1,"soccorritore_base":1}', 'avanzata_rianimazione', 40, 12, 2200, '{}', 3, 3),
      ('emergenza_118', 'verde', 'Frattura arto', 1,
        '{"autista":1,"soccorritore_base":1}', 'avanzata_rianimazione', 40, 12, 2500, '{steccobende}', 2, 1),
      ('emergenza_118', 'giallo', 'Malore', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 45, 16, 3000, '{}', 2, 2),
      ('emergenza_118', 'giallo', 'Dolore toracico (ECG)', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 50, 20, 5000, '{ecg}', 2, 2),
      ('emergenza_118', 'giallo', 'Trauma pediatrico', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 50, 20, 4500, '{spinale_ped,collare}', 1, 1),
      ('emergenza_118', 'giallo', 'Caduta dall''alto', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 55, 22, 4500, '{cucchiaio}', 1, 1),
      ('emergenza_118', 'rosso', 'Incidente stradale', 2,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 60, 28, 6000, '{spinale,collare}', 2, 2),
      ('emergenza_118', 'rosso', 'Incidente con incastrato', 2,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 75, 34, 8500, '{ked,collare}', 1, 1),
      ('emergenza_118', 'rosso', 'Arresto cardiaco', 2,
        '{"autista":1,"soccorritore_avanzato":1,"caposervizio":1}', 'avanzata_rianimazione', 60, 32, 7500, '{defib}', 1, 2)
      ) as v(cat, code, title, slots, roles, cert, dur, fat, reward, req, w_day, w_night)
    ) s
    where s.cum >= r and (case when night then s.w_night else s.w_day end) > 0
    order by s.cum limit 1;

    select * into z from (values
      ('Livorno Centro', 43.5485, 10.3106), ('Livorno Nord', 43.5720, 10.3250),
      ('Ardenza', 43.5180, 10.3200),        ('Montenero', 43.4930, 10.3550),
      ('Collesalvetti', 43.5900, 10.4750),  ('Stagno', 43.6000, 10.3900)
    ) as zz(name, lat, lng) order by random() limit 1;

    insert into missions (category, code, title, location, slots_total, required_roles,
                          min_certification, duration_minutes, base_fatigue, reward_funds,
                          reward_reputation, requires, expires_at, source)
    values (t.cat, t.code, t.title || ' — ' || z.name,
            st_setsrid(st_makepoint(z.lng + (random() - 0.5) * 0.027,
                                    z.lat + (random() - 0.5) * 0.027), 4326)::geography,
            t.slots, t.roles, t.cert, t.dur, t.fat, t.reward,
            case when t.code = 'rosso' then 5 else 1 end, t.req,
            now() + interval '5 minutes', 'scheduler');
    n := n + 1;
  end loop;
  return n;
end $$;
