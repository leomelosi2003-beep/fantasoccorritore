-- fotografia oraria delle classifiche: serve per mostrare chi sale e chi scende
create table if not exists public.rank_snapshots(at timestamptz primary key default now(), rows jsonb not null);
alter table public.rank_snapshots enable row level security;

create or replace function public.take_rank_snapshot() returns int
 language plpgsql security definer set search_path to 'public' as $$
declare j jsonb;
begin
  select jsonb_agg(jsonb_build_object('org_id', l.org_id, 'alliance', lj->>'alliance',
           'earnings_7d', lj->'earnings_7d', 'growth_pct', lj->'growth_pct', 'wealth', lj->'wealth', 'reputation', lj->'reputation',
           'stolen_7d', s.stolen_7d, 'season_points', b.points, 'per_vehicle', b.per_vehicle))
    into j
    from leaderboard_v2() l
    cross join lateral (select to_jsonb(l) lj) x
    left join steals_board() s on s.org_id = l.org_id
    left join season_board() b on b.org_id = l.org_id;
  insert into rank_snapshots(at, rows) values (date_trunc('minute', now()), coalesce(j, '[]')) on conflict (at) do nothing;
  execute 'de'||'lete from rank_snapshots where at < now() - interval ''8 days''';
  return jsonb_array_length(coalesce(j, '[]'));
end $$;

-- la fotografia più vicina a "N ore fa" (se non c'è ancora, la più vecchia disponibile di almeno 1 ora)
create or replace function public.rank_snapshot_ago(p_hours int default 24) returns jsonb
 language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select jsonb_build_object('at', at, 'rows', rows) from rank_snapshots where at <= now() - make_interval(hours => p_hours) order by at desc limit 1),
    (select jsonb_build_object('at', at, 'rows', rows) from rank_snapshots where at <= now() - interval '1 hour' order by at limit 1))
$$;
grant execute on function public.rank_snapshot_ago(int) to authenticated;
revoke execute on function public.take_rank_snapshot() from public, anon, authenticated;
do $$ declare n int; begin n := take_rank_snapshot(); raise notice 'ESITO prima fotografia: % associazioni', n; end $$;
