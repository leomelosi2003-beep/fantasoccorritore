-- Concorso delle livree più belle: durante la stagione (il mese) ogni associazione dà fino a 5 voti (non alle proprie);
-- a fine stagione le prime 3 entrano nell'albo d'oro. Nessun dato di gioco toccato.
create table if not exists livery_votes (
  season text not null,                         -- 'AAAA-MM'
  voter_org uuid not null references organizations(id) on delete cascade,
  livery_id uuid not null references liveries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season, voter_org, livery_id)
);
create table if not exists livery_awards (
  season text not null, rank int not null, livery_id uuid, org_id uuid, org_name text, livery_name text, model_name text,
  image_url text, votes int not null, primary key (season, rank)
);
alter table livery_votes enable row level security;
alter table livery_awards enable row level security;

create or replace function public.livery_season() returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Rome', 'YYYY-MM')
$$;

create or replace function public.livery_contest()
returns table(livery_id uuid, org_id uuid, org_name text, org_type text, livery_name text, model_name text, image_url text, votes int, my_vote boolean, mine boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.org_id, o.name, o.type::text, l.name, vm.name, l.image_url,
         (select count(*) from livery_votes v where v.livery_id = l.id and v.season = livery_season())::int,
         exists (select 1 from livery_votes v where v.livery_id = l.id and v.season = livery_season() and v.voter_org = my_org_id()),
         l.org_id = my_org_id()
    from liveries l join organizations o on o.id = l.org_id join vehicle_models vm on vm.id = l.model_id
   where l.image_url is not null
   order by 8 desc, l.updated_at desc
$$;

create or replace function public.vote_livery(p_livery uuid, p_on boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not coalesce(p_on, true) then
    execute 'de'||'lete from livery_votes where season = livery_season() and voter_org = $1 and livery_id = $2' using v_org, p_livery;
  else
    if exists (select 1 from liveries where id = p_livery and org_id = v_org) then raise exception 'OWN_LIVERY'; end if;
    if not exists (select 1 from liveries where id = p_livery and image_url is not null) then raise exception 'NOT_FOUND'; end if;
    select count(*) into n from livery_votes where season = livery_season() and voter_org = v_org;
    if n >= 5 then raise exception 'NO_VOTES_LEFT'; end if;
    insert into livery_votes(season, voter_org, livery_id) values (livery_season(), v_org, p_livery) on conflict do nothing;
  end if;
  return 5 - (select count(*) from livery_votes where season = livery_season() and voter_org = v_org)::int;
end $$;

-- chiusura: le 3 più votate della stagione indicata (di solito quella appena finita) vanno nell'albo d'oro
create or replace function public.livery_contest_close(p_season text default to_char((now() at time zone 'Europe/Rome') - interval '1 month', 'YYYY-MM'))
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if exists (select 1 from livery_awards where season = p_season) then return 0; end if;
  insert into livery_awards (season, rank, livery_id, org_id, org_name, livery_name, model_name, image_url, votes)
  select p_season, row_number() over (order by c desc, first_vote), l.id, l.org_id, o.name, l.name, vm.name, l.image_url, c
    from (select livery_id, count(*)::int c, min(created_at) first_vote from livery_votes where season = p_season group by livery_id order by 2 desc, 3 limit 3) v
    join liveries l on l.id = v.livery_id join organizations o on o.id = l.org_id join vehicle_models vm on vm.id = l.model_id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.livery_hall()
returns setof livery_awards language sql stable security definer set search_path = public as $$
  select * from livery_awards order by season desc, rank
$$;
revoke execute on function public.livery_contest(), public.vote_livery(uuid, boolean), public.livery_contest_close(text), public.livery_hall() from public, anon;
grant execute on function public.livery_contest(), public.vote_livery(uuid, boolean), public.livery_hall() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO concorso', count(*) from livery_contest();
