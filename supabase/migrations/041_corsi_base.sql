-- CORSI DI FORMAZIONE per i soccorritori base: diventano autisti (4.000 €) o soccorritori avanzati (6.000 €).
-- Resta il corso avanzato → caposervizio (8.000 €). Ogni corso dura 1 ora.
alter table card_inventory add column if not exists guida_override smallint;

create or replace function training_course(p_card uuid, p_target volunteer_role) returns card_inventory
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); c card_inventory; r volunteer_role; cost int;
begin
  select ci.* into c from card_inventory ci where ci.id = p_card and ci.org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(c.role_override, role) into r from volunteers where id = c.volunteer_id;
  cost := case
    when r = 'soccorritore_base' and p_target = 'autista' then 4000
    when r = 'soccorritore_base' and p_target = 'soccorritore_avanzato' then 6000
    when r = 'soccorritore_avanzato' and p_target = 'caposervizio' then 8000 end;
  if cost is null then raise exception 'NOT_UPGRADABLE'; end if;
  if c.state in ('in_servizio','scaduta') then raise exception 'CARD_BUSY'; end if;
  if card_borrower(c.id) is not null then raise exception 'CARD_LENT'; end if;

  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update card_inventory
     set role_override = p_target,
         guida_override = case when p_target = 'autista' then 55 else guida_override end,
         training_until = now() + interval '1 hour',
         state = 'riposo', rest_until = greatest(coalesce(rest_until, now()), now() + interval '1 hour')
   where id = c.id returning * into c;
  return c;
end $$;
grant execute on function training_course(uuid, volunteer_role) to authenticated;

create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, coalesce(ci.role_override, v.role) as role,
       v.rarity, v.gender, v.avatar_url,
       coalesce(ci.guida_override, v.stat_guida) as stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato,
       case when ci.org_id = my_org_id() then (select name from organizations where id = card_borrower(ci.id)) end as lent_to,
       case when ci.org_id <> my_org_id() then (select name from organizations where id = ci.org_id) end as lent_from,
       ci.training_until, ci.role_override is not null as promoted
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id() or card_borrower(ci.id) = my_org_id();
select 1;
