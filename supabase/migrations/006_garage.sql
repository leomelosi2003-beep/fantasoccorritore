-- Logo degli allestitori (le immagini dei modelli usano vehicle_models.image_url)
alter table builders add column if not exists logo_url text;
alter table builders add column if not exists description text;
alter table vehicle_models add column if not exists description text;

-- Fondi iniziali sufficienti per la prima ambulanza
alter table organizations alter column funds set default 25000;
update organizations set funds = greatest(funds, 25000);

-- Catalogo modelli (nomi fittizi)
insert into vehicle_models (name, base_cost, speed_factor, base_reliability, base_durability, description) values
  ('R-Masteron',   7000, 0.95, 65, 80, 'Robusto ed economico, un po'' lento.'),
  ('F-Ducalis',    9000, 1.00, 72, 72, 'Il classico equilibrato: va bene per tutto.'),
  ('M-Sprinterix', 13000, 1.10, 82, 70, 'Veloce e affidabile, ma costa di più.')
on conflict (name) do nothing;

-- Catalogo allestitori (nomi fittizi)
insert into builders (name, cost, value_score, reliability, durability, certification, bonus, description) values
  ('Mafra Allestimenti', 3000, 55,  0,  5, 'trasporto',             '{}',                    'Allestimento da trasporto: dialisi, dimissioni, ordinari.'),
  ('Orionis',            6000, 70,  5, 10, 'base',                  '{}',                    'Omologato per emergenza: codici verdi e gialli.'),
  ('Alexis',            11000, 90, 10, 15, 'avanzata_rianimazione', '{"reward_mult":0.05}',  'Mezzo di rianimazione: anche codici rossi, +5% ricompense.')
on conflict (name) do nothing;

-- Acquisto di un mezzo
create or replace function buy_vehicle(p_model_id uuid, p_builder_id uuid, p_base_id uuid, p_call_sign text)
returns vehicles language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); mdl vehicle_models; bld builders; b bases; parked int; total int; v vehicles;
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

  total := mdl.base_cost + bld.cost;
  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - total where id = v_org and funds >= total;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  insert into vehicles (org_id, base_id, model_id, builder_id, call_sign, certification,
                        reliability, durability, value_score)
  values (v_org, b.id, mdl.id, bld.id, trim(p_call_sign), bld.certification,
          least(100, mdl.base_reliability + bld.reliability),
          least(100, mdl.base_durability + bld.durability),
          bld.value_score)
  returning * into v;
  return v;
end $$;

grant execute on function buy_vehicle(uuid, uuid, uuid, text) to authenticated;
grant execute on function start_maintenance(uuid) to authenticated;
