-- 0263: punti del campionato e dell'albo d'oro solo da chi arriva ai quarti di finale in su:
-- torneo vinto 10, finale 6, semifinale 3, quarti di finale 1 (niente più punto per ogni incontro vinto).
-- Contano anche i tornei giocati prima delle serie.
create or replace function public.tournament_placings(p_from timestamptz, p_to timestamptz)
returns table(org_id uuid, pts int, wins int, finals int, semis int, quarters int)
language sql stable security definer set search_path = public as $$
  with fin as (select id, rounds, winner_org, runner_org from tournaments
                where status = 'finito' and starts_at >= p_from and starts_at < p_to),
  lost as (select fin.rounds - m.round back, case when m.winner_org = m.org_a then m.org_b else m.org_a end org_id
             from tournament_matches m join fin on fin.id = m.tournament_id
            where m.org_b is not null and m.round between fin.rounds - 2 and fin.rounds - 1),
  p as (select winner_org org_id, 10 pt, 1 w, 0 f, 0 s, 0 q from fin
        union all select runner_org, 6, 0, 1, 0, 0 from fin where runner_org is not null
        union all select org_id, 3, 0, 0, 1, 0 from lost where back = 1
        union all select org_id, 1, 0, 0, 0, 1 from lost where back = 2)
  select org_id, sum(pt)::int, sum(w)::int, sum(f)::int, sum(s)::int, sum(q)::int
    from p where org_id is not null group by org_id
$$;

create or replace function public.division_points(p_from timestamptz, p_to timestamptz)
returns table(org_id uuid, points int, wins int, finals int, matches_won int)
language sql stable security definer set search_path = public as $$
  -- matches_won ora = semifinali + quarti raggiunti (per la colonna in classifica)
  select org_id, pts, wins, finals, semis + quarters from tournament_placings(p_from, p_to)
$$;
revoke execute on function public.division_points(timestamptz, timestamptz), public.tournament_placings(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.tournament_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with pl as (select * from tournament_placings('2000-01-01', 'infinity')),
  ch as (select winner_org org_id, count(*)::int n from challenges where status = 'finita' and winner_org is not null group by winner_org),
  agg as (select coalesce(pl.org_id, ch.org_id) org_id, coalesce(pl.wins, 0) wins, coalesce(pl.finals, 0) finals, coalesce(pl.semis, 0) semis,
                 coalesce(pl.quarters, 0) quarters, coalesce(ch.n, 0) ch, coalesce(pl.pts, 0) + coalesce(ch.n, 0) points
            from pl full join ch on ch.org_id = pl.org_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url,
           'wins', a.wins, 'finals', a.finals, 'semis', a.semis, 'quarters', a.quarters, 'challenges', a.ch, 'points', a.points, 'me', o.id = my_org_id())
           order by a.points desc, a.wins desc, o.name), '[]'::jsonb)
    from agg a join organizations o on o.id = a.org_id where a.points > 0
$$;
grant execute on function public.tournament_board() to authenticated;
do $$ begin raise notice 'ESITO punti dai quarti: tornei finiti %, associazioni con punti questa settimana %',
  (select count(*) from tournaments where status = 'finito'),
  (select count(*) from division_points(week_start(), week_start() + interval '7 days')); end $$;
