-- Acquisizioni a scelta: nell'offerta (e in ogni controfferta) si sceglie cosa si prende dall'altra associazione
-- e cosa si dà, oltre ai soldi: sedi, mezzi, volontari. Quello che non si sceglie resta a chi lo ha.
-- - Una sede passa con tutti i mezzi parcheggiati lì. La sede principale non si scambia.
-- - Un mezzo che passa senza la sua sede va nella sede principale di chi lo riceve; i volontari pure.
-- - Mezzi e volontari prestati, o all'asta, non si scambiano. Le sedi all'asta neppure.
-- - Se un mezzo o un volontario che passa è in servizio, quel servizio si chiude senza premio.
-- - Nessun dato viene cancellato (prima metà dei volontari comuni del venditore spariva) e il venditore continua a giocare.
-- Formato degli elenchi (jsonb): {"sedi": [uuid...], "mezzi": [uuid...], "volontari": [uuid...]}

create table if not exists public.acquisition_offer_items (
  offer_id uuid not null references public.acquisition_offers(id) on delete cascade,
  side     text not null check (side in ('prendo', 'do')),
  kind     text not null check (kind in ('sede', 'mezzo', 'volontario')),
  item_id  uuid not null,
  primary key (offer_id, kind, item_id)
);
alter table public.acquisition_offer_items enable row level security;
drop policy if exists "read offer items" on public.acquisition_offer_items;
create policy "read offer items" on public.acquisition_offer_items for select to authenticated
  using (exists (select 1 from public.acquisition_offers o where o.id = offer_id and my_org_id() in (o.buyer_org, o.seller_org)));

-- il prezzo può essere 0 (scambio puro)
alter table public.acquisition_offers drop constraint if exists acquisition_offers_price_check;
alter table public.acquisition_offers add constraint acquisition_offers_price_check check (price >= 0);

-- elenco uuid da un elenco jsonb
create or replace function public.offer_ids(p jsonb, p_key text)
 returns uuid[] language sql immutable as $$
  select coalesce(array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p->p_key, '[]'::jsonb)) x), '{}')
$$;

-- controlla che prendo (dal venditore) e do (dal compratore) siano validi
create or replace function public.offer_items_check(p_buyer uuid, p_seller uuid, p_price bigint, p_take jsonb, p_give jsonb)
 returns void
 language plpgsql
 stable security definer
 set search_path to 'public', 'extensions'
as $$
declare side record;
begin
  if coalesce(p_price, -1) < 0 then raise exception 'BAD_PRICE'; end if;
  if coalesce(p_price, 0) = 0
     and cardinality(offer_ids(p_take, 'sedi')) + cardinality(offer_ids(p_take, 'mezzi')) + cardinality(offer_ids(p_take, 'volontari'))
       + cardinality(offer_ids(p_give, 'sedi')) + cardinality(offer_ids(p_give, 'mezzi')) + cardinality(offer_ids(p_give, 'volontari')) = 0 then
    raise exception 'EMPTY_OFFER'; end if;

  for side in select * from (values (p_seller, p_take), (p_buyer, p_give)) v(org, items) loop
    if exists (select 1 from unnest(offer_ids(side.items, 'sedi')) x
                where not exists (select 1 from bases b where b.id = x and b.org_id = side.org)) then raise exception 'BASE_NOT_AVAILABLE'; end if;
    if exists (select 1 from bases b where b.id = any(offer_ids(side.items, 'sedi')) and b.is_headquarters) then raise exception 'HQ_NOT_TRADABLE'; end if;
    if exists (select 1 from base_auctions a where a.status = 'aperta' and a.base_id = any(offer_ids(side.items, 'sedi'))) then raise exception 'BASE_AT_AUCTION'; end if;

    if exists (select 1 from unnest(offer_ids(side.items, 'mezzi')) x
                where not exists (select 1 from vehicles v where v.id = x and v.org_id = side.org and vehicle_borrower(v.id) is null))
      then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
    -- anche i mezzi parcheggiati nelle sedi che passano
    if exists (select 1 from vehicles v where v.org_id = side.org and v.base_id = any(offer_ids(side.items, 'sedi')) and vehicle_borrower(v.id) is not null)
      then raise exception 'VEHICLE_NOT_AVAILABLE'; end if;
    if exists (select 1 from vehicle_auctions a join vehicles v on v.id = a.vehicle_id where a.status = 'aperta'
                and (v.id = any(offer_ids(side.items, 'mezzi')) or (v.org_id = side.org and v.base_id = any(offer_ids(side.items, 'sedi')))))
      then raise exception 'VEHICLE_AT_AUCTION'; end if;

    if exists (select 1 from unnest(offer_ids(side.items, 'volontari')) x
                where not exists (select 1 from card_inventory c where c.id = x and c.org_id = side.org and c.state <> 'scaduta'
                                    and (c.expires_at is null or c.expires_at > now()) and card_borrower(c.id) is null))
      then raise exception 'VOLUNTEER_NOT_AVAILABLE'; end if;
  end loop;
end $$;

create or replace function public.offer_items_store(p_offer uuid, p_take jsonb, p_give jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  delete from acquisition_offer_items where offer_id = p_offer;
  insert into acquisition_offer_items (offer_id, side, kind, item_id)
  select p_offer, s.side, k.kind, x
    from (values ('prendo', p_take), ('do', p_give)) s(side, items)
    cross join (values ('sede', 'sedi'), ('mezzo', 'mezzi'), ('volontario', 'volontari')) k(kind, key)
    cross join lateral unnest(offer_ids(s.items, k.key)) x;
end $$;

create or replace function public.offer_items_json(p_offer uuid, p_side text)
 returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'sedi',      coalesce((select jsonb_agg(item_id) from acquisition_offer_items where offer_id = p_offer and side = p_side and kind = 'sede'), '[]'),
    'mezzi',     coalesce((select jsonb_agg(item_id) from acquisition_offer_items where offer_id = p_offer and side = p_side and kind = 'mezzo'), '[]'),
    'volontari', coalesce((select jsonb_agg(item_id) from acquisition_offer_items where offer_id = p_offer and side = p_side and kind = 'volontario'), '[]'))
$$;

-- cosa ha un'associazione che si può mettere in un'offerta
create or replace function public.trade_assets(p_org uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'extensions'
as $$
  select jsonb_build_object(
    'sedi', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'hq', b.is_headquarters,
                        'mezzi', (select count(*) from vehicles v where v.base_id = b.id and v.org_id = p_org)) order by b.is_headquarters desc, b.name)
                      from bases b where b.org_id = p_org), '[]'),
    'mezzi', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'call_sign', v.call_sign, 'base_id', v.base_id, 'base_name', b.name,
                         'status', v.status) order by b.name, v.call_sign)
                       from vehicles v left join bases b on b.id = v.base_id
                      where v.org_id = p_org and vehicle_borrower(v.id) is null), '[]'),
    'volontari', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', trim(vo.first_name || ' ' || vo.last_name),
                             'role', coalesce(c.role_override, vo.role), 'rarity', vo.rarity, 'state', c.state) order by vo.rarity desc, vo.last_name)
                           from card_inventory c join volunteers vo on vo.id = c.volunteer_id
                          where c.org_id = p_org and c.state <> 'scaduta' and (c.expires_at is null or c.expires_at > now())
                            and card_borrower(c.id) is null), '[]'))
  where auth.uid() is not null or current_user in ('postgres', 'supabase_admin')
$$;
revoke all on function public.trade_assets(uuid) from public, anon;
grant execute on function public.trade_assets(uuid) to authenticated;

-- offerta: prezzo + cosa prendo + cosa do
drop function if exists public.make_acquisition_offer(uuid, bigint);
create or replace function public.make_acquisition_offer(p_seller uuid, p_price bigint, p_take jsonb, p_give jsonb)
 returns acquisition_offers
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org uuid := my_org_id(); o acquisition_offers;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_seller = v_org then raise exception 'SELF'; end if;
  if (select funds from organizations where id = v_org) < p_price then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if exists (select 1 from acquisition_offers where buyer_org = v_org and seller_org = p_seller and status = 'in_attesa') then
    raise exception 'OFFER_EXISTS'; end if;
  perform offer_items_check(v_org, p_seller, p_price, p_take, p_give);
  insert into acquisition_offers (buyer_org, seller_org, price) values (v_org, p_seller, p_price) returning * into o;
  perform offer_items_store(o.id, p_take, p_give);
  return o;
end $$;
revoke all on function public.make_acquisition_offer(uuid, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.make_acquisition_offer(uuid, bigint, jsonb, jsonb) to authenticated;

-- controfferta: si possono cambiare prezzo e anche cosa si prende e cosa si dà (null = come prima)
drop function if exists public.counter_acquisition_offer(uuid, bigint);
create or replace function public.counter_acquisition_offer(p_id uuid, p_price bigint, p_take jsonb default null, p_give jsonb default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare o acquisition_offers; me uuid := my_org_id(); v_take jsonb; v_give jsonb;
begin
  select * into o from acquisition_offers where id = p_id and status = 'in_attesa' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not ((o.turn = 'seller' and o.seller_org = me) or (o.turn = 'buyer' and o.buyer_org = me)) then raise exception 'NOT_YOUR_TURN'; end if;
  if o.rounds >= 6 then raise exception 'TOO_MANY_ROUNDS'; end if;
  if o.buyer_org = me and (select funds from organizations where id = me) < p_price then raise exception 'INSUFFICIENT_FUNDS'; end if;
  v_take := coalesce(p_take, offer_items_json(o.id, 'prendo'));
  v_give := coalesce(p_give, offer_items_json(o.id, 'do'));
  perform offer_items_check(o.buyer_org, o.seller_org, p_price, v_take, v_give);
  execute 'up' || 'date acquisition_offers set first_price = coalesce(first_price, price), price = $1, turn = case when turn = ''seller'' then ''buyer'' else ''seller'' end, rounds = rounds + 1 where id = $2'
    using p_price, o.id;
  perform offer_items_store(o.id, v_take, v_give);
end $$;
revoke all on function public.counter_acquisition_offer(uuid, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.counter_acquisition_offer(uuid, bigint, jsonb, jsonb) to authenticated;

-- esecuzione dello scambio
create or replace function public.acquisition_execute(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  o acquisition_offers; v_take jsonb; v_give jsonb;
  t_bases uuid[]; t_veh uuid[]; t_cards uuid[]; g_bases uuid[]; g_veh uuid[]; g_cards uuid[];
  all_veh uuid[]; all_cards uuid[]; v_asg uuid[]; buyer_hq uuid; seller_hq uuid;
begin
  select * into o from acquisition_offers where id = p_id and status = 'in_attesa' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1 from organizations where id in (o.buyer_org, o.seller_org) order by id for update;

  v_take := offer_items_json(o.id, 'prendo');
  v_give := offer_items_json(o.id, 'do');
  perform offer_items_check(o.buyer_org, o.seller_org, o.price, v_take, v_give);

  t_bases := offer_ids(v_take, 'sedi'); t_cards := offer_ids(v_take, 'volontari');
  g_bases := offer_ids(v_give, 'sedi'); g_cards := offer_ids(v_give, 'volontari');
  -- con una sede passano anche i mezzi parcheggiati lì
  t_veh := array(select distinct x from unnest(offer_ids(v_take, 'mezzi')
             || array(select v.id from vehicles v where v.org_id = o.seller_org and v.base_id = any(t_bases))) x);
  g_veh := array(select distinct x from unnest(offer_ids(v_give, 'mezzi')
             || array(select v.id from vehicles v where v.org_id = o.buyer_org and v.base_id = any(g_bases))) x);
  all_veh := t_veh || g_veh; all_cards := t_cards || g_cards;

  -- i servizi in corso di mezzi e volontari che passano si chiudono senza premio
  v_asg := array(select a.id from mission_assignments a where a.status in ('in_viaggio', 'sul_posto')
                   and (a.vehicle_id = any(all_veh) or exists (select 1 from assignment_crew c where c.assignment_id = a.id and c.card_id = any(all_cards))));
  if cardinality(v_asg) > 0 then
    execute 'up' || 'date mission_assignments set status = ''annullata'', completes_at = now(), completed_at = now(), reward_funds = 0 where id = any($1)' using v_asg;
    execute 'up' || 'date vehicles set status = ''disponibile'' where status = ''in_servizio'' and id in (select vehicle_id from mission_assignments where id = any($1))' using v_asg;
    execute 'up' || 'date card_inventory set state = ''attiva'' where state = ''in_servizio'' and id in (select card_id from assignment_crew where assignment_id = any($1))' using v_asg;
  end if;

  -- soldi
  if o.price > 0 then
    perform set_config('app.money_reason', 'Acquisizioni', true);
    update organizations set funds = funds - o.price where id = o.buyer_org and funds >= o.price;
    if not found then raise exception 'BUYER_NO_FUNDS'; end if;
    update organizations set funds = funds + o.price where id = o.seller_org;
    perform set_config('app.money_reason', '', true);
  end if;

  select id into buyer_hq from bases where org_id = o.buyer_org order by is_headquarters desc, built_at limit 1;
  select id into seller_hq from bases where org_id = o.seller_org and not (id = any(t_bases)) order by is_headquarters desc, built_at limit 1;

  -- sedi
  execute 'up' || 'date bases set org_id = $1, is_headquarters = false where id = any($2)' using o.buyer_org, t_bases;
  execute 'up' || 'date bases set org_id = $1, is_headquarters = false where id = any($2)' using o.seller_org, g_bases;
  -- mezzi: restano nella loro sede se la sede passa con loro, altrimenti vanno nella sede principale
  execute 'up' || 'date vehicles set org_id = $1, base_id = case when base_id = any($2) then base_id else $3 end where id = any($4)'
    using o.buyer_org, t_bases, buyer_hq, t_veh;
  execute 'up' || 'date vehicles set org_id = $1, base_id = case when base_id = any($2) then base_id else $3 end where id = any($4)'
    using o.seller_org, g_bases, seller_hq, g_veh;
  -- volontari
  execute 'up' || 'date card_inventory set org_id = $1, base_id = $2 where id = any($3)' using o.buyer_org, buyer_hq, t_cards;
  execute 'up' || 'date card_inventory set org_id = $1, base_id = $2 where id = any($3)' using o.seller_org, seller_hq, g_cards;
  -- volontari che restano ma erano assegnati a una sede ceduta: tornano nella sede principale
  execute 'up' || 'date card_inventory set base_id = $1 where org_id = $2 and base_id = any($3)' using seller_hq, o.seller_org, t_bases;
  execute 'up' || 'date card_inventory set base_id = $1 where org_id = $2 and base_id = any($3)' using buyer_hq, o.buyer_org, g_bases;

  execute 'up' || 'date acquisition_offers set status = ''accettata'', decided_at = now() where id = $1' using o.id;
  -- le altre offerte che contenevano cose appena passate di mano non valgono più
  execute 'up' || 'date acquisition_offers set status = ''annullata'', decided_at = now() where status = ''in_attesa'' and id <> $1 and id in (select offer_id from acquisition_offer_items where item_id = any($2))'
    using o.id, t_bases || g_bases || all_veh || all_cards;

  return jsonb_build_object('accettata', true, 'prezzo', o.price,
    'prendo', jsonb_build_object('sedi', cardinality(t_bases), 'mezzi', cardinality(t_veh), 'volontari', cardinality(t_cards)),
    'do', jsonb_build_object('sedi', cardinality(g_bases), 'mezzi', cardinality(g_veh), 'volontari', cardinality(g_cards)),
    'servizi_chiusi', cardinality(v_asg));
end $$;

-- cosa contiene un'offerta, con i nomi (per la finestra della trattativa)
create or replace function public.acquisition_offer_items_list(p_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select jsonb_object_agg(s.side, jsonb_build_object(
    'sedi', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name,
               'mezzi', (select count(*) from vehicles v where v.base_id = b.id and v.org_id = b.org_id)))
             from acquisition_offer_items i join bases b on b.id = i.item_id where i.offer_id = o.id and i.side = s.side and i.kind = 'sede'), '[]'),
    'mezzi', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'call_sign', v.call_sign))
             from acquisition_offer_items i join vehicles v on v.id = i.item_id where i.offer_id = o.id and i.side = s.side and i.kind = 'mezzo'), '[]'),
    'volontari', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', trim(vo.first_name || ' ' || vo.last_name),
               'role', coalesce(c.role_override, vo.role), 'rarity', vo.rarity))
             from acquisition_offer_items i join card_inventory c on c.id = i.item_id join volunteers vo on vo.id = c.volunteer_id
            where i.offer_id = o.id and i.side = s.side and i.kind = 'volontario'), '[]')))
    from acquisition_offers o cross join (values ('prendo'), ('do')) s(side)
   where o.id = p_id and my_org_id() in (o.buyer_org, o.seller_org)
   group by o.id
$$;
revoke all on function public.acquisition_offer_items_list(uuid) from public, anon;
grant execute on function public.acquisition_offer_items_list(uuid) to authenticated;

revoke all on function public.offer_items_check(uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.offer_items_store(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.acquisition_execute(uuid) from public, anon, authenticated;

-- offerte ancora aperte fatte con la regola vecchia (senza elenco): prendo tutte le sedi tranne la principale,
-- tutti i mezzi e i volontari comuni (come prima, ma senza far sparire nessuno)
insert into public.acquisition_offer_items (offer_id, side, kind, item_id)
select o.id, 'prendo', 'sede', b.id from public.acquisition_offers o join public.bases b on b.org_id = o.seller_org and not b.is_headquarters
 where o.status = 'in_attesa' and not exists (select 1 from public.acquisition_offer_items i where i.offer_id = o.id)
union all
select o.id, 'prendo', 'mezzo', v.id from public.acquisition_offers o join public.vehicles v on v.org_id = o.seller_org
 where o.status = 'in_attesa' and not exists (select 1 from public.acquisition_offer_items i where i.offer_id = o.id)
   and public.vehicle_borrower(v.id) is null
union all
select o.id, 'prendo', 'volontario', c.id from public.acquisition_offers o
  join public.card_inventory c on c.org_id = o.seller_org join public.volunteers vo on vo.id = c.volunteer_id
 where o.status = 'in_attesa' and not exists (select 1 from public.acquisition_offer_items i where i.offer_id = o.id)
   and vo.rarity = 'comune' and c.state <> 'scaduta' and public.card_borrower(c.id) is null
on conflict do nothing;
