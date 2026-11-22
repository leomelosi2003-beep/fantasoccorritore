-- Premi alleanza: primi 10 posti, cifra intera a ogni membro (20M a calare)
create or replace function public.alliance_prize(p_rank int) returns bigint language sql immutable as $$
  select (array[20000000,15000000,12000000,10000000,8000000,6000000,5000000,4000000,3000000,2000000])[p_rank]::bigint
$$;
create or replace function public.close_alliance_season(p_season date) returns int
 language plpgsql security definer set search_path to 'public' as $$
declare a record; best uuid; prize bigint; k int := 0; mon text := to_char(p_season, 'MM/YY');
begin
  if exists (select 1 from alliance_season_awards where season = p_season) then return 0; end if;
  for a in
    select am.alliance_id, al.name, sum(sb.points)::bigint pts
      from season_board(p_season) sb join alliance_members am on am.org_id = sb.org_id join alliances al on al.id = am.alliance_id
     group by am.alliance_id, al.name having sum(sb.points) > 0 order by sum(sb.points) desc limit 10
  loop
    k := k + 1;
    prize := alliance_prize(k);
    perform set_config('app.money_reason', format('Premio alleanza %s° posto (stagione %s)', k, mon), true);
    execute 'up'||'date organizations set funds = funds + $1 where id in (select org_id from alliance_members where alliance_id = $2)' using prize, a.alliance_id;
    perform set_config('app.money_reason', '', true);
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
do $$ begin raise notice 'ESITO premi alleanza primi 10'; end $$;
