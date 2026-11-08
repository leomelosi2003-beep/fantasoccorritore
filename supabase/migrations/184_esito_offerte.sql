-- 184: esito delle offerte di acquisto/scambio.
-- Chi ha fatto l'ultima proposta non sapeva se era stata accettata o rifiutata: ora riceve un avviso
-- a tutta pagina. Chi decide e' sempre la parte a cui tocca ("turn" resta com'era al momento della risposta),
-- quindi l'avviso va all'altra parte. Si vede una volta sola (tabella offer_outcome_seen).

create table if not exists public.offer_outcome_seen (
  org_id uuid not null references public.organizations(id),
  offer_id uuid not null references public.acquisition_offers(id),
  seen_at timestamptz not null default now(),
  primary key (org_id, offer_id)
);
alter table public.offer_outcome_seen enable row level security;

create or replace function public.my_offer_outcomes()
returns table(id uuid, status text, price bigint, decided_at timestamptz, my_role text, other_name text, items jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.price, o.decided_at,
         case when o.buyer_org = my_org_id() then 'compratore' else 'venditore' end,
         case when o.buyer_org = my_org_id() then s.name else b.name end,
         acquisition_offer_items_list(o.id)
    from acquisition_offers o
    join organizations b on b.id = o.buyer_org
    join organizations s on s.id = o.seller_org
   where o.status in ('accettata', 'rifiutata')
     and o.decided_at > now() - interval '7 days'
     -- io sono la parte che NON ha deciso
     and ((o.turn = 'seller' and o.buyer_org = my_org_id()) or (o.turn = 'buyer' and o.seller_org = my_org_id()))
     and not exists (select 1 from offer_outcome_seen x where x.org_id = my_org_id() and x.offer_id = o.id)
   order by o.decided_at
$$;
grant execute on function public.my_offer_outcomes() to authenticated;

create or replace function public.mark_offer_outcome_seen(p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into offer_outcome_seen(org_id, offer_id)
  select my_org_id(), o.id from acquisition_offers o
   where o.id = p_id and my_org_id() in (o.buyer_org, o.seller_org)
  on conflict do nothing
$$;
grant execute on function public.mark_offer_outcome_seen(uuid) to authenticated;

-- Le offerte decise prima di oggi non fanno comparire l'avviso (solo quelle nuove)
insert into public.offer_outcome_seen(org_id, offer_id)
select x.org, o.id from public.acquisition_offers o
cross join lateral (values (o.buyer_org), (o.seller_org)) x(org)
where o.status in ('accettata', 'rifiutata')
on conflict do nothing;
