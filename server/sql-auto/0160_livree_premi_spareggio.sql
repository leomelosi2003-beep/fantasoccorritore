-- Concorso livree: piccolo premio ai primi 3 e spareggio di 24 ore se c'è un pareggio che decide un podio.
-- Le livree con 0 voti non entrano in niente.
create table if not exists public.livery_runoffs(
  season text primary key, ends_at timestamptz not null, closed boolean not null default false);
create table if not exists public.livery_runoff_candidates(
  season text not null, livery_id uuid not null, base_votes int not null, first_vote timestamptz, grp int not null,
  primary key (season, livery_id));
create table if not exists public.livery_runoff_votes(
  season text not null, voter_org uuid not null, grp int not null, livery_id uuid not null, created_at timestamptz not null default now(),
  primary key (season, voter_org, grp));
alter table public.livery_runoffs enable row level security;
alter table public.livery_runoff_candidates enable row level security;
alter table public.livery_runoff_votes enable row level security;
alter table public.livery_awards add column if not exists prize bigint not null default 0;

create or replace function public.livery_prize(p_rank int) returns bigint language sql immutable as $$
  select (array[1000000, 500000, 250000])[p_rank]::bigint
$$;

-- assegna podio + premi a partire da un ordinamento già deciso
create or replace function public.livery_award_podium(p_season text, p_ids uuid[]) returns int
 language plpgsql security definer set search_path to 'public' as $$
declare k int := 0; lid uuid; c int; l record;
begin
  foreach lid in array p_ids loop
    k := k + 1; exit when k > 3;
    select count(*)::int into c from livery_votes where season = p_season and livery_id = lid;
    select l2.id, l2.org_id, o.name oname, l2.name lname, vm.name mname, l2.image_url into l
      from liveries l2 join organizations o on o.id = l2.org_id join vehicle_models vm on vm.id = l2.model_id where l2.id = lid;
    if l.id is null then k := k - 1; continue; end if;
    insert into livery_awards (season, rank, livery_id, org_id, org_name, livery_name, model_name, image_url, votes, prize)
    values (p_season, k, l.id, l.org_id, l.oname, l.lname, l.mname, l.image_url, c, livery_prize(k)) on conflict do nothing;
    perform set_config('app.money_reason', format('Premio livrea più bella %s° posto (%s)', k, p_season), true);
    execute 'up'||'date organizations set funds = funds + $1 where id = $2' using livery_prize(k), l.org_id;
  end loop;
  perform set_config('app.money_reason', '', true);
  return least(k, 3);
end $$;

-- chiusura del mese: se un pareggio decide un posto del podio parte lo spareggio, altrimenti premia subito
create or replace function public.livery_contest_close(p_season text default to_char((now() at time zone 'Europe/Rome') - interval '1 month', 'YYYY-MM'))
returns int language plpgsql security definer set search_path = public as $$
declare r record; pos int := 1; g int := 0; tie boolean := false; ids uuid[];
begin
  if exists (select 1 from livery_awards where season = p_season) or exists (select 1 from livery_runoffs where season = p_season) then return 0; end if;
  -- gruppi di livree con gli stessi voti, solo quelle con almeno 1 voto e solo finché si è dentro il podio
  for r in select c, count(*)::int n, array_agg(livery_id order by fv) ids
             from (select livery_id, count(*)::int c, min(created_at) fv from livery_votes where season = p_season group by livery_id) x
            group by c order by c desc loop
    exit when pos > 3;
    g := g + 1;
    if r.n > 1 then
      tie := true;
      insert into livery_runoff_candidates(season, livery_id, base_votes, first_vote, grp)
      select p_season, v.livery_id, r.c, min(v.created_at), g from livery_votes v where v.season = p_season and v.livery_id = any(r.ids) group by v.livery_id;
    end if;
    pos := pos + r.n;
  end loop;
  if tie then
    insert into livery_runoffs(season, ends_at) values (p_season, now() + interval '24 hours');
    return -1;
  end if;
  select array_agg(livery_id order by c desc, fv) into ids
    from (select livery_id, count(*)::int c, min(created_at) fv from livery_votes where season = p_season group by livery_id) x;
  return livery_award_podium(p_season, coalesce(ids, '{}'));
end $$;

-- fine spareggio: ordine = voti del mese, poi voti dello spareggio, poi chi è stato votato prima
create or replace function public.livery_runoff_close() returns int
 language plpgsql security definer set search_path = public as $$
declare ro record; ids uuid[]; n int := 0;
begin
  for ro in select * from livery_runoffs where not closed and ends_at <= now() loop
    select array_agg(livery_id order by c desc, coalesce(rv, 0) desc, fv) into ids from (
      select v.livery_id, count(*)::int c, min(v.created_at) fv,
             (select count(*) from livery_runoff_votes r where r.season = ro.season and r.livery_id = v.livery_id) rv
        from livery_votes v where v.season = ro.season group by v.livery_id) x;
    perform livery_award_podium(ro.season, coalesce(ids, '{}'));
    execute 'up'||'date livery_runoffs set closed = true where season = $1' using ro.season;
    n := n + 1;
  end loop;
  return n;
end $$;

-- per il sito: spareggio in corso, candidati e il mio voto
create or replace function public.livery_runoff_state()
returns table(season text, ends_at timestamptz, grp int, livery_id uuid, org_id uuid, org_name text, org_type text, livery_name text, model_name text,
              image_url text, base_votes int, runoff_votes int, my_vote boolean, mine boolean)
 language sql stable security definer set search_path = public as $$
  select ro.season, ro.ends_at, c.grp, l.id, l.org_id, o.name, o.type::text, l.name, vm.name, l.image_url, c.base_votes,
         (select count(*) from livery_runoff_votes v where v.season = ro.season and v.livery_id = l.id)::int,
         exists (select 1 from livery_runoff_votes v where v.season = ro.season and v.livery_id = l.id and v.voter_org = my_org_id()),
         l.org_id = my_org_id()
    from livery_runoffs ro join livery_runoff_candidates c on c.season = ro.season
    join liveries l on l.id = c.livery_id join organizations o on o.id = l.org_id join vehicle_models vm on vm.id = l.model_id
   where not ro.closed order by c.grp, c.first_vote
$$;

create or replace function public.vote_livery_runoff(p_livery uuid) returns void
 language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); c record;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select c2.* into c from livery_runoff_candidates c2 join livery_runoffs ro on ro.season = c2.season
   where c2.livery_id = p_livery and not ro.closed and ro.ends_at > now();
  if c.livery_id is null then raise exception 'RUNOFF_CLOSED'; end if;
  if exists (select 1 from liveries where id = p_livery and org_id = v_org) then raise exception 'OWN_LIVERY'; end if;
  insert into livery_runoff_votes(season, voter_org, grp, livery_id) values (c.season, v_org, c.grp, p_livery)
  on conflict (season, voter_org, grp) do update set livery_id = excluded.livery_id, created_at = now();
end $$;

revoke execute on function public.livery_runoff_state(), public.vote_livery_runoff(uuid), public.livery_runoff_close(), public.livery_award_podium(text, uuid[]) from public, anon;
grant execute on function public.livery_runoff_state(), public.vote_livery_runoff(uuid) to authenticated;
do $$ begin raise notice 'ESITO concorso livree con premi e spareggio'; end $$;
