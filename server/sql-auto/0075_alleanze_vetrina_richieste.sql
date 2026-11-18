-- Alleanze: vetrina di tutte le alleanze (logo, banner, fondo, quota stimata), richiesta di entrare (l'amministratore
-- accetta → arriva l'invito da firmare), tassa proporzionata per tutti (stessa percentuale dei soldi in cassa).

create table if not exists alliance_join_requests (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references alliances(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (alliance_id, org_id)
);
alter table alliance_join_requests enable row level security;
drop policy if exists alliance_join_requests_read on alliance_join_requests;
create policy alliance_join_requests_read on alliance_join_requests for select to authenticated
  using (org_id = my_org_id() or alliance_id in (select id from alliances where founder_org = my_org_id()));
grant select on alliance_join_requests to authenticated;

create or replace function public.request_join_alliance(p_alliance uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_org_id() is null then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from alliance_members where org_id = my_org_id()) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
  if not exists (select 1 from alliances where id = p_alliance) then raise exception 'NOT_FOUND'; end if;
  insert into alliance_join_requests (alliance_id, org_id) values (p_alliance, my_org_id()) on conflict do nothing;
end $$;

create or replace function public.cancel_join_request(p_alliance uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  execute 'de'||'lete from alliance_join_requests where alliance_id = $1 and org_id = $2' using p_alliance, my_org_id();
end $$;

-- l'amministratore accetta (diventa un invito: l'associazione deve ancora firmare il contratto) o rifiuta
create or replace function public.answer_join_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r alliance_join_requests;
begin
  select * into r from alliance_join_requests where id = p_request;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from alliances where id = r.alliance_id and founder_org = my_org_id()) then raise exception 'NOT_ADMIN'; end if;
  if p_accept then
    if exists (select 1 from alliance_members where org_id = r.org_id) then raise exception 'ALREADY_IN_ALLIANCE'; end if;
    insert into alliance_invites (alliance_id, org_id) values (r.alliance_id, r.org_id) on conflict do nothing;
  end if;
  execute 'de'||'lete from alliance_join_requests where id = $1' using r.id;
end $$;

-- richieste arrivate alla mia alleanza (solo amministratore)
create or replace function public.admin_join_requests()
returns table (id uuid, org_id uuid, org_name text, org_type text, logo_url text, reputation int, vehicles bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, o.id, o.name, o.type::text, o.logo_url, o.reputation::int,
         (select count(*) from vehicles v where v.org_id = o.id), r.created_at
  from alliance_join_requests r join organizations o on o.id = r.org_id
  join alliances a on a.id = r.alliance_id
  where a.founder_org = my_org_id() order by r.created_at
$$;

-- vetrina: tutte le alleanze con quanto riceveresti domenica entrando
create or replace function public.alliances_directory()
returns table (id uuid, name text, logo_url text, banner_url text, motto text, fund bigint, members bigint, founder_name text,
               last_share bigint, est_share bigint, is_mine boolean, requested boolean, invited boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.logo_url, a.banner_url, a.motto, a.fund,
         (select count(*) from alliance_members m where m.alliance_id = a.id) n,
         (select name from organizations where id = a.founder_org),
         (select (l.amount / greatest(l.members, 1))::bigint from alliance_fund_log l where l.alliance_id = a.id and l.kind = 'ripartizione' order by l.at desc limit 1),
         -- quota stimata a testa domenica (contando anche te se non ci sei ancora)
         (a.fund / greatest(1, (select count(*) from alliance_members m where m.alliance_id = a.id)
                         + case when exists (select 1 from alliance_members m where m.alliance_id = a.id and m.org_id = my_org_id()) then 0 else 1 end))::bigint,
         exists (select 1 from alliance_members m where m.alliance_id = a.id and m.org_id = my_org_id()),
         exists (select 1 from alliance_join_requests r where r.alliance_id = a.id and r.org_id = my_org_id()),
         exists (select 1 from alliance_invites i where i.alliance_id = a.id and i.org_id = my_org_id())
  from alliances a order by n desc, a.fund desc
$$;

-- tassa proporzionata: ogni ora ogni associazione di un'alleanza (con almeno 2 aderenti) versa lo 0,03% dei soldi in cassa
-- (circa il 5% a settimana): chi ha tanto versa tanto, chi ha poco versa poco; poi la domenica si divide in parti uguali.
create or replace function public.alliance_tax()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare r record; amt bigint; n int := 0;
begin
  for r in
    select o.id, am.alliance_id, o.funds from organizations o join alliance_members am on am.org_id = o.id
     where o.funds > 0 and (select count(*) from alliance_members x where x.alliance_id = am.alliance_id) >= 2
  loop
    amt := floor(r.funds * 0.0003);
    continue when amt < 1;
    perform set_config('app.money_reason', 'Quota alleanza (fondo comune, 0,03% l''ora)', true);
    update organizations set funds = funds - amt where id = r.id;
    execute 'up'||'date alliances set fund = fund + $1 where id = $2' using amt, r.alliance_id;
    insert into alliance_fund_log (alliance_id, org_id, kind, amount) values (r.alliance_id, r.id, 'tassa', amt);
    n := n + 1;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $function$;

grant execute on function public.request_join_alliance(uuid), public.cancel_join_request(uuid), public.answer_join_request(uuid, boolean),
  public.admin_join_requests(), public.alliances_directory() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO vetrina', count(*) from alliances_directory();
