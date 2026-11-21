-- Premi di fine stagione per le alleanze (punti di stagione dei membri sommati)
create table if not exists public.alliance_season_awards(
  season date not null, rank int not null, alliance_id uuid, alliance_name text not null, points bigint not null,
  prize_funds bigint not null default 0, prize_note text, vehicles_to uuid, at timestamptz not null default now(),
  primary key (season, rank));
alter table public.alliance_season_awards enable row level security;
drop policy if exists asa_read on public.alliance_season_awards;
create policy asa_read on public.alliance_season_awards for select to authenticated using (true);
grant select on public.alliance_season_awards to authenticated;

-- regala un mezzo con tutti i presidi alla sede principale (premio: niente controllo garage)
create or replace function public.prize_vehicle(p_org uuid, p_model text, p_call text) returns uuid
 language plpgsql security definer set search_path to 'public' as $$
declare mdl vehicle_models; bld builders; hq uuid; eq text[]; vid uuid;
begin
  select * into mdl from vehicle_models where name = p_model and is_active;
  select * into bld from builders where is_active order by reliability + durability desc, cost desc limit 1;
  select id into hq from bases where org_id = p_org order by is_headquarters desc, built_at limit 1;
  if mdl.id is null or bld.id is null or hq is null then return null; end if;
  if mdl.moto then eq := array['dae','borsoni'];
  else eq := array['lt35','barella_auto','borsoni','collari','cucchiaio','ked','massaggiatore','materasso','spinale','spinale_ped','steccobende']; end if;
  eq := array(select c from unnest(eq) c where c <> all(coalesce(mdl.banned_equipment, '{}')));
  insert into vehicles (org_id, base_id, model_id, builder_id, call_sign, certification, reliability, durability, value_score, equipment)
  values (p_org, hq, mdl.id, bld.id, left(p_call, 20), 'avanzata_rianimazione', least(100, mdl.base_reliability + bld.reliability),
          least(100, mdl.base_durability + bld.durability), bld.value_score, eq)
  returning id into vid;
  return vid;
end $$;

create or replace function public.close_alliance_season(p_season date) returns int
 language plpgsql security definer set search_path to 'public' as $$
declare a record; m record; n int; best uuid; prize bigint; each bigint; k int := 0; mon text := to_char(p_season, 'MM/YY');
begin
  if exists (select 1 from alliance_season_awards where season = p_season) then return 0; end if;
  for a in
    select am.alliance_id, al.name, sum(sb.points)::bigint pts
      from season_board(p_season) sb join alliance_members am on am.org_id = sb.org_id join alliances al on al.id = am.alliance_id
     group by am.alliance_id, al.name having sum(sb.points) > 0 order by sum(sb.points) desc limit 3
  loop
    k := k + 1;
    prize := case k when 1 then 30000000 when 2 then 5000000 else 1000000 end;
    select count(*) into n from alliance_members where alliance_id = a.alliance_id;
    each := prize / greatest(n, 1);
    perform set_config('app.money_reason', format('Premio alleanza %s° posto (stagione %s)', k, mon), true);
    execute 'up'||'date organizations set funds = funds + $1 where id in (select org_id from alliance_members where alliance_id = $2)' using each, a.alliance_id;
    perform set_config('app.money_reason', '', true);
    -- i mezzi vanno al membro che ha fatto più punti
    select sb.org_id into best from season_board(p_season) sb join alliance_members am on am.org_id = sb.org_id
     where am.alliance_id = a.alliance_id order by sb.points desc limit 1;
    if k = 1 then perform prize_vehicle(best, 'M-Sprinterix', 'Premio ' || mon || ' A'); perform prize_vehicle(best, 'M-Sprinterix', 'Premio ' || mon || ' B');
    elsif k = 2 then perform prize_vehicle(best, 'Y-Scootix', 'Premio moto ' || mon); end if;
    insert into alliance_season_awards(season, rank, alliance_id, alliance_name, points, prize_funds, prize_note, vehicles_to)
    values (p_season, k, a.alliance_id, a.name, a.pts, prize,
            case k when 1 then '2 ambulanze M-Sprinterix con kit completo' when 2 then '1 motorino' end, case when k < 3 then best end);
  end loop;
  return k;
end $$;

-- la chiusura del mese premia anche le alleanze
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('close_season'::regproc), E'\r\n', E'\n');
  if position('close_alliance_season' in src) > 0 then raise notice 'ESITO già collegato'; return; end if;
  new_src := replace(src, E'  return n;\nend', E'  perform close_alliance_season(p_season);\n  return n;\nend');
  if new_src = src then raise exception 'ESITO patch close_season non applicata'; end if;
  execute new_src;
  raise notice 'ESITO premi alleanze attivi';
end $$;
