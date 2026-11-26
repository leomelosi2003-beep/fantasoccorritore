-- 0252: ai tornei partecipano TUTTE le associazioni che hanno almeno un mezzo (prima solo quelle con servizi negli ultimi 2 giorni).
create or replace function public.tournament_active_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by rep desc nulls last), '{}') from (
    select o.id, o.reputation rep from organizations o
     where exists (select 1 from vehicles v where v.org_id = o.id)
     order by o.reputation desc nulls last limit 64) s
$$;
create or replace function public.tournament_auto_entries(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int; room int;
begin
  select count(*) into n from tournament_entries where tournament_id = p_id;
  room := greatest(0, 64 - n);
  insert into tournament_entries (tournament_id, org_id)
  select p_id, o.id from organizations o
   where not exists (select 1 from tournament_entries e where e.tournament_id = p_id and e.org_id = o.id)
     and exists (select 1 from vehicles v where v.org_id = o.id)
   order by o.reputation desc nulls last
   limit room
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function public.tournament_expected() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(array_length(tournament_active_ids(), 1), 0)
$$;
do $$ begin raise notice 'ESITO partecipanti: % su % associazioni', tournament_expected(), (select count(*) from organizations); end $$;
