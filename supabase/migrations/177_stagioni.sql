-- 177: Stagioni mensili.
-- Ogni mese si riparte da zero SOLO nella classifica di stagione: soldi, mezzi e storico NON si toccano.
-- Punti stagione: rosso 3, giallo 2, altri 1, maxi-emergenze e incendi 5, +20 per ogni obiettivo ritirato.
-- Due classifiche: "Stagione" (punti) e "Rivelazione" (punti per mezzo: anche le associazioni piccole possono vincere).
-- A fine mese i primi 3 di ciascuna ricevono un titolo permanente (season_awards), mostrato in classifica.

create table if not exists public.season_awards (
  season date not null,            -- primo giorno del mese
  category text not null,          -- 'punti' | 'rivelazione'
  rank smallint not null,
  org_id uuid not null references public.organizations(id),
  points numeric not null,
  primary key (season, category, rank)
);
alter table public.season_awards enable row level security;
drop policy if exists season_awards_read on public.season_awards;
create policy season_awards_read on public.season_awards for select using (true);
grant select on public.season_awards to anon, authenticated;

create or replace function public.season_board(p_season date default null)
returns table(org_id uuid, name text, type text, logo_url text, points bigint, vehicles int, per_vehicle numeric)
language sql stable security definer set search_path = public as $$
  with b as (
    select coalesce(p_season, date_trunc('month', now() at time zone 'Europe/Rome')::date) s
  ), r as (
    select (s::timestamp at time zone 'Europe/Rome') f, ((s + interval '1 month')::timestamp at time zone 'Europe/Rome') t, s from b
  ), pts as (
    select a.org_id, sum(case
             when m.category = 'grande_evento' and m.event_id is null then 5
             when m.code = 'rosso' then 3 when m.code = 'giallo' then 2 else 1 end)::bigint p
      from mission_assignments a join missions m on m.id = a.mission_id, r
     where a.status = 'conclusa' and a.completed_at >= r.f and a.completed_at < r.t and not a.support
     group by a.org_id
  ), obj as (
    select c.org_id, count(*) * 20 p from objective_claims c, r
     where c.claimed_at >= r.f and c.claimed_at < r.t group by c.org_id
  ), veh as (
    select v.org_id, count(*)::int n from vehicles v group by v.org_id
  )
  select o.id, o.name, o.type::text, o.logo_url,
         (coalesce(pts.p, 0) + coalesce(obj.p, 0))::bigint,
         coalesce(veh.n, 0),
         round((coalesce(pts.p, 0) + coalesce(obj.p, 0))::numeric / greatest(3, coalesce(veh.n, 0)), 1)
    from organizations o
    left join pts on pts.org_id = o.id left join obj on obj.org_id = o.id left join veh on veh.org_id = o.id
   where coalesce(pts.p, 0) + coalesce(obj.p, 0) > 0
$$;
grant execute on function public.season_board(date) to authenticated;

-- Chiude una stagione (idempotente): salva i primi 3 di ogni classifica
create or replace function public.close_season(p_season date)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  insert into season_awards(season, category, rank, org_id, points)
  select p_season, 'punti', row_number() over (order by points desc), org_id, points
    from season_board(p_season) order by points desc limit 3
  on conflict do nothing;
  get diagnostics n = row_count;
  insert into season_awards(season, category, rank, org_id, points)
  select p_season, 'rivelazione', row_number() over (order by per_vehicle desc, points desc), org_id, per_vehicle
    from season_board(p_season) where points >= 300 order by per_vehicle desc, points desc limit 3
  on conflict do nothing;
  return n;
end $$;
revoke all on function public.close_season(date) from public, anon, authenticated;

-- Ogni primo del mese (00:05 UTC) chiude il mese appena finito
select cron.unschedule(jobid) from cron.job where jobname = 'season-close';
select cron.schedule('season-close', '5 0 1 * *',
  $$select public.close_season(date_trunc('month', (now() at time zone 'Europe/Rome') - interval '1 day')::date)$$);
