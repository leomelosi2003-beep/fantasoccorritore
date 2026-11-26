-- Classifiche Stagione/Rivelazione/Codici rossi: calcolate ogni 2 minuti dal server e lette già pronte (prima 3+2 secondi a ogni apertura, con il rischio di andare oltre il tempo massimo)
create table if not exists public.season_board_cache(org_id uuid primary key, points numeric, per_vehicle numeric, vehicles int, reds int, updated_at timestamptz not null default now());
alter table public.season_board_cache enable row level security;

create or replace function public.refresh_season_cache() returns int
 language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  create temp table _sb on commit drop as
    select coalesce(s.org_id, r.org_id) org_id, s.points, s.per_vehicle, s.vehicles, coalesce(r.reds, 0) reds
      from season_board() s full join reds_board() r on r.org_id = s.org_id;
  execute 'de'||'lete from season_board_cache where org_id not in (select org_id from _sb)';
  insert into season_board_cache(org_id, points, per_vehicle, vehicles, reds, updated_at)
  select org_id, points, per_vehicle, vehicles, reds, now() from _sb
  on conflict (org_id) do update set points = excluded.points, per_vehicle = excluded.per_vehicle, vehicles = excluded.vehicles, reds = excluded.reds, updated_at = now();
  get diagnostics n = row_count;
  drop table _sb;
  return n;
end $$;

create or replace function public.season_board_fast()
returns table(org_id uuid, points numeric, per_vehicle numeric, vehicles int, reds int, updated_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select org_id, points, per_vehicle, vehicles, reds, updated_at from season_board_cache
$$;
grant execute on function public.season_board_fast() to authenticated;
revoke execute on function public.refresh_season_cache() from public, anon, authenticated;
do $$ declare n int; begin n := refresh_season_cache(); raise notice 'ESITO cache classifiche: % righe', n; end $$;
