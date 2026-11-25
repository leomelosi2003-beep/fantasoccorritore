-- confronto anche con fotografie di almeno 25 minuti fa (prima serviva un'ora)
create or replace function public.rank_snapshot_ago(p_hours int default 24) returns jsonb
 language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select jsonb_build_object('at', at, 'rows', rows) from rank_snapshots where at <= now() - make_interval(hours => p_hours) order by at desc limit 1),
    (select jsonb_build_object('at', at, 'rows', rows) from rank_snapshots where at <= now() - interval '25 minutes' order by at limit 1))
$$;
do $$ begin raise notice 'ESITO confronto da 25 minuti'; end $$;
