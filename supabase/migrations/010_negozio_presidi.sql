-- Negozio presidi: compra un presidio e montalo su un mezzo.
-- Se nello stesso slot c'era già un presidio, viene sostituito (il vecchio è ritirato).
create or replace function install_equipment(p_vehicle_id uuid, p_code text)
returns vehicles language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); v vehicles; e equipment; new_eq text[];
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into e from equipment where code = p_code;
  if not found then raise exception 'BAD_EQUIPMENT'; end if;
  select * into v from vehicles where id = p_vehicle_id and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if v.status <> 'disponibile' then raise exception 'VEHICLE_BUSY'; end if;
  if p_code = any(v.equipment) then raise exception 'ALREADY_INSTALLED'; end if;

  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - e.cost where id = v_org and funds >= e.cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  select coalesce(array_agg(c), '{}') into new_eq
    from unnest(v.equipment) c
   where c not in (select code from equipment where slot = e.slot);
  new_eq := new_eq || p_code;

  update vehicles
     set equipment = new_eq,
         certification = case when 'emergenza' = any(vehicle_provides(new_eq))
                               then 'avanzata_rianimazione'::certification else 'trasporto'::certification end
   where id = v.id
  returning * into v;
  return v;
end $$;
grant execute on function install_equipment(uuid, text) to authenticated;
