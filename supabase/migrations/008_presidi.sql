-- PRESIDI: equipaggiamento a scelta per ogni mezzo.
-- Tutti gli allestitori fanno emergenza; cosa può fare il mezzo lo decidono i presidi.

create table if not exists equipment (
  code        text primary key,
  slot        text not null,            -- monitor | barella | massaggiatore | spinale | borsoni
  name        text not null,
  cost        integer not null,
  provides    text[] not null default '{}',   -- capacità: defib, ecg, spinale, emergenza
  effects     jsonb not null default '{}',    -- reward_mult (+ "on": codice/requisito), fatigue_mult
  description text,
  image_url   text,
  sort        smallint not null default 0
);
alter table equipment enable row level security;
drop policy if exists "read equipment" on equipment;
create policy "read equipment" on equipment for select using (true);
grant select on equipment to anon, authenticated;

insert into equipment (code, slot, name, cost, provides, effects, description, sort) values
  ('dae',          'monitor',       'DAE',                          1500, '{defib}',      '{}',
     'Defibrillatore semiautomatico. Basta per i codici rossi, ma niente ECG.', 1),
  ('lt15',         'monitor',       'Cardiomonitor LifeTrack 15',  25000, '{defib,ecg}',  '{"reward_mult":0.10,"on":"ecg"}',
     'Monitor-defibrillatore con ECG a 12 derivazioni: puoi fare i servizi ECG (+10%).', 2),
  ('lt35',         'monitor',       'Cardiomonitor LifeTrack 35',  40000, '{defib,ecg}',  '{"reward_mult":0.20,"on":"ecg"}',
     'Ultimo modello, ECG trasmesso in centrale: servizi ECG +20%.', 3),
  ('barella_std',  'barella',       'Barella standard',             4000, '{}',           '{}',
     'Barella classica a carico manuale.', 1),
  ('barella_auto', 'barella',       'Barella autocaricante Strykon', 30000, '{}',         '{"fatigue_mult":-0.15}',
     'Si carica da sola: l''equipaggio si stanca il 15% in meno.', 2),
  ('massaggiatore','massaggiatore', 'Massaggiatore cardiaco automatico', 15000, '{}',   '{"reward_mult":0.15,"on":"rosso"}',
     'Compressioni automatiche: codici rossi +15%.', 1),
  ('spinale',      'spinale',       'Tavola spinale',                 600, '{spinale}',   '{}',
     'Necessaria per i traumi e gli incidenti stradali.', 1),
  ('borsoni',      'borsoni',       'Borsoni emergenza',             2500, '{emergenza}', '{}',
     'Zaini e borsoni per l''emergenza: senza, il mezzo fa solo trasporti.', 1)
on conflict (code) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost,
  provides = excluded.provides, effects = excluded.effects, description = excluded.description, sort = excluded.sort;

-- Mezzi: presidi montati
alter table vehicles add column if not exists equipment text[] not null default '{}';

-- Servizi: requisiti di presidio (es. {ecg}, {spinale}, {defib})
alter table missions add column if not exists requires text[] not null default '{}';

-- Tutti gli allestitori possono fare emergenza: differiscono per qualità e redditività
update builders set certification = 'avanzata_rianimazione';
update builders set description = 'Allestimento essenziale ed economico.' where name = 'Mafra Allestimenti';
update builders set description = 'Buona qualità costruttiva. Ricompense +5%.' where name = 'Alexis';
update builders set description = 'Il top: più affidabile, più resistente. Ricompense +15%.' where name = 'Orionis';

-- Capacità di un mezzo
create or replace function vehicle_provides(p_equipment text[]) returns text[]
language sql stable set search_path = public, extensions as $$
  select coalesce(array_agg(distinct p), '{}') from equipment e, unnest(e.provides) p
  where e.code = any(p_equipment)
$$;

-- Acquisto con presidi
drop function if exists buy_vehicle(uuid, uuid, uuid, text);
create or replace function buy_vehicle(p_model_id uuid, p_builder_id uuid, p_base_id uuid,
                                       p_call_sign text, p_equipment text[])
returns vehicles language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); mdl vehicle_models; bld builders; b bases; parked int;
        total int; eq_cost int; n_mon int; n_bar int; n_dup int; v vehicles;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into mdl from vehicle_models where id = p_model_id and is_active;
  if not found then raise exception 'MODEL_NOT_FOUND'; end if;
  select * into bld from builders where id = p_builder_id and is_active;
  if not found then raise exception 'BUILDER_NOT_FOUND'; end if;
  select * into b from bases where id = p_base_id and org_id = v_org;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;

  select count(*) into parked from vehicles where base_id = b.id and status <> 'fuori_servizio';
  if parked >= b.vehicle_capacity then raise exception 'BASE_FULL'; end if;
  if char_length(trim(coalesce(p_call_sign, ''))) not between 2 and 20 then raise exception 'BAD_CALL_SIGN'; end if;

  -- presidi: esattamente un monitor e una barella, il resto facoltativo, niente doppioni di slot
  if exists (select 1 from unnest(coalesce(p_equipment,'{}')) c where c not in (select code from equipment)) then
    raise exception 'BAD_EQUIPMENT'; end if;
  select count(*) filter (where slot = 'monitor'), count(*) filter (where slot = 'barella'),
         count(*) - count(distinct slot), coalesce(sum(cost), 0)
    into n_mon, n_bar, n_dup, eq_cost
    from equipment where code = any(p_equipment);
  if n_mon <> 1 then raise exception 'NEED_ONE_MONITOR'; end if;
  if n_bar <> 1 then raise exception 'NEED_ONE_STRETCHER'; end if;
  if n_dup > 0 then raise exception 'BAD_EQUIPMENT'; end if;

  total := mdl.base_cost + bld.cost + eq_cost;
  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - total where id = v_org and funds >= total;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  insert into vehicles (org_id, base_id, model_id, builder_id, call_sign, certification,
                        reliability, durability, value_score, equipment)
  values (v_org, b.id, mdl.id, bld.id, trim(p_call_sign),
          case when 'emergenza' = any(vehicle_provides(p_equipment))
               then 'avanzata_rianimazione'::certification else 'trasporto'::certification end,
          least(100, mdl.base_reliability + bld.reliability),
          least(100, mdl.base_durability + bld.durability),
          bld.value_score, p_equipment)
  returning * into v;
  return v;
end $$;
grant execute on function buy_vehicle(uuid, uuid, uuid, text, text[]) to authenticated;

-- Bonus ricompensa dei presidi (es. massaggiatore sui rossi, cardiomonitor sui servizi ECG)
create or replace function equipment_reward_mult(p_eq text[], p_code text, p_requires text[]) returns numeric
language sql stable set search_path = public, extensions as $$
  select coalesce(sum((effects->>'reward_mult')::numeric), 0) from equipment
  where code = any(p_eq) and effects ? 'reward_mult'
    and (not effects ? 'on' or effects->>'on' = p_code or effects->>'on' = any(p_requires))
$$;

-- Riduzione fatica dei presidi (es. barella autocaricante)
create or replace function equipment_fatigue_mult(p_eq text[]) returns numeric
language sql stable set search_path = public, extensions as $$
  select coalesce(sum((effects->>'fatigue_mult')::numeric), 0) from equipment
  where code = any(p_eq) and effects ? 'fatigue_mult'
$$;

-- claim_mission: il mezzo deve avere i presidi richiesti
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('MISSING_EQUIPMENT' in src) = 0 then
    src := replace(src,
      'raise exception ''CERTIFICATION_TOO_LOW''; end if;',
      'raise exception ''CERTIFICATION_TOO_LOW''; end if;
  if not (m.requires <@ vehicle_provides(veh.equipment)) then
    raise exception ''MISSING_EQUIPMENT:%'', array_to_string(m.requires, '',''); end if;');
    execute src;
  end if;
end $do$;

-- complete_due_assignments: bonus e fatica dei presidi
do $do$
declare src text;
begin
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  if position('equipment_reward_mult' in src) = 0 then
    src := replace(src,
      'f := mission_fatigue(m.id, cr.volunteer_id, a.assigned_at);',
      'f := mission_fatigue(m.id, cr.volunteer_id, a.assigned_at);
      f := round(greatest(1, f * (1 + equipment_fatigue_mult(veh.equipment))), 2);');
    src := replace(src,
      'update organizations set funds = funds + reward,',
      'reward := round(reward * (1 + equipment_reward_mult(veh.equipment, m.code::text, m.requires)));
    update organizations set funds = funds + reward,');
    execute src;
  end if;
end $do$;

-- Vista mappa con i requisiti
drop view if exists missions_map;
create view missions_map with (security_invoker = true) as
select id, category, code, title, venue, slots_total, slots_taken, required_roles,
       min_certification, requires, reward_funds, expires_at, status,
       st_y(location::geometry) as lat, st_x(location::geometry) as lng
from missions
where status in ('completa','in_corso') or (status = 'aperta' and expires_at > now());
grant select on missions_map to anon, authenticated;

-- Generatore con i nuovi tipi di servizio
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
    r := random() * case when night then 12 else 17 end;
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
      ('emergenza_118', 'giallo', 'Malore', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 45, 16, 3000, '{}', 2, 2),
      ('emergenza_118', 'giallo', 'Dolore toracico (ECG)', 1,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 50, 20, 5000, '{ecg}', 2, 2),
      ('emergenza_118', 'rosso', 'Incidente stradale', 2,
        '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}', 'avanzata_rianimazione', 60, 28, 6000, '{spinale}', 2, 2),
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
