-- NEGOZIO CARTE: l'admin mette un prezzo alle carte che crea; tutti i giocatori possono comprarle (una volta ciascuno).
alter table volunteers add column if not exists shop_price int check (shop_price is null or shop_price >= 0);

create or replace function buy_card(p_volunteer uuid) returns card_inventory
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v volunteers; c card_inventory;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into v from volunteers where id = p_volunteer and shop_price is not null;
  if not found then raise exception 'NOT_FOR_SALE'; end if;
  if exists (select 1 from card_inventory where org_id = v_org and volunteer_id = v.id and state <> 'scaduta') then
    raise exception 'ALREADY_OWNED'; end if;
  perform 1 from organizations where id = v_org for update;
  update organizations set funds = funds - v.shop_price where id = v_org and funds >= v.shop_price;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  insert into card_inventory (org_id, volunteer_id, base_id)
  values (v_org, v.id, (select id from bases where org_id = v_org and is_headquarters))
  returning * into c;
  return c;
end $$;
grant execute on function buy_card(uuid) to authenticated;

create or replace view shop_cards with (security_invoker = true) as
select v.id, v.first_name, v.last_name, v.nickname, v.role, v.rarity, v.gender, v.avatar_url,
       v.stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato, v.shop_price,
       exists (select 1 from card_inventory ci where ci.org_id = my_org_id() and ci.volunteer_id = v.id and ci.state <> 'scaduta') as owned
  from volunteers v where v.shop_price is not null;
grant select on shop_cards to authenticated;
