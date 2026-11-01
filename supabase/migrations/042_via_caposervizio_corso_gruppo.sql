-- 1) Via la figura del caposervizio: diventano tutti soccorritori avanzati.
--    Chi aveva pagato il corso da caposervizio viene rimborsato (8.000 € a persona).
update organizations o set funds = funds + x.n * 8000
  from (select org_id, count(*) n from card_inventory where role_override = 'caposervizio' group by org_id) x
 where o.id = x.org_id;
update card_inventory set role_override = null, training_until = null where role_override = 'caposervizio';
update volunteers set role = 'soccorritore_avanzato' where role = 'caposervizio';

-- Le emergenze chiedono autista + 2 soccorritori avanzati (niente più caposervizio)
create or replace function normalize_emergency_roles() returns trigger
language plpgsql as $$
begin
  if new.category = 'emergenza_118' then
    new.required_roles := '{"autista": 1, "soccorritore_avanzato": 2}'::jsonb;
  elsif new.required_roles ? 'caposervizio' then
    new.required_roles := (new.required_roles - 'caposervizio')
      || jsonb_build_object('soccorritore_avanzato',
           coalesce((new.required_roles->>'soccorritore_avanzato')::int, 0) + (new.required_roles->>'caposervizio')::int);
  end if;
  return new;
end $$;
drop trigger if exists missions_emergency_roles on missions;
create trigger missions_emergency_roles before insert or update of required_roles, category on missions
  for each row execute function normalize_emergency_roles();
update missions set required_roles = required_roles where status = 'aperta' and required_roles ? 'caposervizio';

-- 2) Corso di formazione di gruppo: 8.000 € per una classe fino a 10 soccorritori base,
--    che diventano tutti autisti oppure tutti soccorritori avanzati. Dura 1 ora.
create or replace function training_class(p_cards uuid[], p_target volunteer_role) returns int
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); n int; cost int := 8000;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_target not in ('autista', 'soccorritore_avanzato') then raise exception 'NOT_UPGRADABLE'; end if;
  n := coalesce(cardinality(p_cards), 0);
  if n = 0 then raise exception 'NO_CREW'; end if;
  if n > 10 then raise exception 'TOO_MANY'; end if;
  if (select count(*) from card_inventory ci join volunteers v on v.id = ci.volunteer_id
       where ci.id = any(p_cards) and ci.org_id = v_org
         and coalesce(ci.role_override, v.role) = 'soccorritore_base'
         and ci.state not in ('in_servizio', 'scaduta') and card_borrower(ci.id) is null) <> n then
    raise exception 'NOT_UPGRADABLE'; end if;

  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update card_inventory
     set role_override = p_target,
         guida_override = case when p_target = 'autista' then 55 else guida_override end,
         training_until = now() + interval '1 hour',
         state = 'riposo', rest_until = greatest(coalesce(rest_until, now()), now() + interval '1 hour')
   where id = any(p_cards);
  return n;
end $$;
grant execute on function training_class(uuid[], volunteer_role) to authenticated;

-- I vecchi corsi singoli non servono più
revoke execute on function training_course(uuid) from public, authenticated;
revoke execute on function training_course(uuid, volunteer_role) from public, authenticated;

select (select count(*) from volunteers where role = 'caposervizio') capo_rimasti,
       (select count(*) from missions where status = 'aperta' and required_roles ? 'caposervizio') missioni_con_capo;
