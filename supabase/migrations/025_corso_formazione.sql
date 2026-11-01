-- CORSO DI FORMAZIONE: un soccorritore avanzato diventa caposervizio pagando. Il corso dura 1 ora.
alter table card_inventory add column if not exists role_override volunteer_role;
alter table card_inventory add column if not exists training_until timestamptz;

create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, coalesce(ci.role_override, v.role) as role,
       v.rarity, v.gender, v.avatar_url,
       v.stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato,
       case when ci.org_id = my_org_id() then (select name from organizations where id = card_borrower(ci.id)) end as lent_to,
       case when ci.org_id <> my_org_id() then (select name from organizations where id = ci.org_id) end as lent_from,
       ci.training_until, ci.role_override is not null as promoted
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id() or card_borrower(ci.id) = my_org_id();

create or replace function training_course(p_card uuid) returns card_inventory
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); c card_inventory; r volunteer_role; cost int := 8000;
begin
  select ci.* into c from card_inventory ci where ci.id = p_card and ci.org_id = v_org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(c.role_override, role) into r from volunteers where id = c.volunteer_id;
  if r <> 'soccorritore_avanzato' then raise exception 'NOT_UPGRADABLE'; end if;
  if c.state in ('in_servizio','scaduta') then raise exception 'CARD_BUSY'; end if;
  if card_borrower(c.id) is not null then raise exception 'CARD_LENT'; end if;

  update organizations set funds = funds - cost where id = v_org and funds >= cost;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update card_inventory
     set role_override = 'caposervizio', training_until = now() + interval '1 hour',
         state = 'riposo', rest_until = greatest(coalesce(rest_until, now()), now() + interval '1 hour')
   where id = c.id returning * into c;
  return c;
end $$;
grant execute on function training_course(uuid) to authenticated;

-- I servizi usano il ruolo dopo il corso
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('role_override' in src) = 0 then
    src := replace(src, 'select ci.*, vo.role, vo.id as vol_id', 'select ci.*, coalesce(ci.role_override, vo.role) as role, vo.id as vol_id');
    src := replace(src, 'select a.id, ci.id, vo.role', 'select a.id, ci.id, coalesce(ci.role_override, vo.role)');
    execute src;
  end if;
end $do$;

select (length(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure))
      - length(replace(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure), 'role_override', ''))) / 13 as sostituzioni;
