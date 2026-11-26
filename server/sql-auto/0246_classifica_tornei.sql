-- 0246: classifica di chi vince più tornei (vittorie, finali, semifinali, sfide vinte)
create or replace function public.tournament_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with fin as (
    select t.id, t.rounds, t.winner_org, t.runner_org from tournaments t where t.status = 'finito'
  ), semi as (
    select case when m.winner_org = m.org_a then m.org_b else m.org_a end org_id
      from tournament_matches m join fin on fin.id = m.tournament_id
     where fin.rounds >= 2 and m.round = fin.rounds - 1 and m.org_b is not null
  ), pts as (
    select winner_org org_id, 1 wins, 0 finals, 0 semis, 0 ch from fin
    union all select runner_org, 0, 1, 0, 0 from fin where runner_org is not null
    union all select org_id, 0, 0, 1, 0 from semi
    union all select winner_org, 0, 0, 0, 1 from challenges where status = 'finita' and winner_org is not null
  ), agg as (
    select org_id, sum(wins)::int wins, sum(finals)::int finals, sum(semis)::int semis, sum(ch)::int ch,
           (sum(wins) * 10 + sum(finals) * 5 + sum(semis) * 2 + sum(ch))::int points
      from pts where org_id is not null group by org_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url,
           'wins', a.wins, 'finals', a.finals, 'semis', a.semis, 'challenges', a.ch, 'points', a.points, 'me', o.id = my_org_id())
           order by a.points desc, a.wins desc, o.name), '[]'::jsonb)
    from agg a join organizations o on o.id = a.org_id
$$;
grant execute on function public.tournament_board() to authenticated;
do $$ begin raise notice 'ESITO classifica tornei: % righe', jsonb_array_length(public.tournament_board()); end $$;
