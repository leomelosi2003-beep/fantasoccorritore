-- Alleanze: premi solo ai primi 3 (30M / 5M / 1M a ogni membro + mezzi)
create or replace function public.alliance_prize(p_rank int) returns bigint language sql immutable as $$
  select (array[30000000,5000000,1000000])[p_rank]::bigint
$$;
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('close_alliance_season'::regproc), E'\r\n', E'\n');
  new_src := replace(src, 'order by sum(sb.points) desc limit 10', 'order by sum(sb.points) desc limit 3');
  if new_src = src then raise exception 'ESITO patch alleanza non applicata'; end if;
  execute new_src;
end $$;

-- Premi di stagione: Stagione (punti), Reputazione, Rivelazione → primi 10, 20M a calare
create table if not exists public.season_prizes(
  season date not null, category text not null, rank int not null, org_id uuid not null, score numeric, amount bigint not null,
  at timestamptz not null default now(), primary key (season, category, rank));
alter table public.season_prizes enable row level security;
drop policy if exists sp_read on public.season_prizes;
create policy sp_read on public.season_prizes for select to authenticated using (true);
grant select on public.season_prizes to authenticated;

create or replace function public.season_prize(p_rank int) returns bigint language sql immutable as $$
  select (array[20000000,15000000,12000000,10000000,8000000,6000000,5000000,4000000,3000000,2000000])[p_rank]::bigint
$$;

create or replace function public.pay_season_prizes(p_season date) returns int
 language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; mon text := to_char(p_season, 'MM/YY');
  lbl constant jsonb := '{"punti":"Stagione","reputazione":"Reputazione","rivelazione":"Rivelazione"}';
begin
  if exists (select 1 from season_prizes where season = p_season) then return 0; end if;
  for r in
    select 'punti' cat, row_number() over (order by points desc) rk, org_id, points::numeric sc from season_board(p_season) where points > 0 order by points desc limit 10
  loop
    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.rk::int)); n := n + 1; end loop;
  for r in
    select 'rivelazione' cat, row_number() over (order by per_vehicle desc, points desc) rk, org_id, per_vehicle sc from season_board(p_season)
     where points >= 300 order by per_vehicle desc, points desc limit 10
  loop
    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.rk::int)); n := n + 1; end loop;
  for r in
    select 'reputazione' cat, row_number() over (order by reputation desc) rk, id org_id, reputation::numeric sc from organizations
     where reputation > 0 order by reputation desc limit 10
  loop
    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.rk::int)); n := n + 1; end loop;
  for r in select * from season_prizes where season = p_season loop
    perform set_config('app.money_reason', format('Premio %s %s° posto (stagione %s)', lbl->>r.category, r.rank, mon), true);
    execute 'up'||'date organizations set funds = funds + $1 where id = $2' using r.amount, r.org_id;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $$;

do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('close_season'::regproc), E'\r\n', E'\n');
  if position('pay_season_prizes' in src) > 0 then raise notice 'ESITO già collegato'; return; end if;
  new_src := replace(src, E'  perform close_alliance_season(p_season);', E'  perform close_alliance_season(p_season);\n  perform pay_season_prizes(p_season);');
  if new_src = src then raise exception 'ESITO patch close_season non applicata'; end if;
  execute new_src;
  raise notice 'ESITO premi stagione attivi, alleanze solo primi 3';
end $$;
