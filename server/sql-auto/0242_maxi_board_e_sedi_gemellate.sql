-- 1) Sede condivisa col gemello: il nome della sede non cambia più
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('twin_rename_base'::regproc), E'\r\n', E'\n');
  new_src := replace(src, $a$  update bases set collab_org = p_twin,
                   name = '🤝 ' || (select name from organizations where id = v_org) || ' × ' || (select name from organizations where id = p_twin)
   where id = p_base;$a$, $a$  update bases set collab_org = p_twin where id = p_base;   -- il nome della sede resta quello originale$a$);
  if new_src = src then raise exception 'ESITO patch gemellaggio non applicata'; end if;
  execute new_src;
end $$;

-- 2) Nuova classifica premiata: 🆘 mezzi mandati sulle maxi emergenze nel mese
create or replace function public.maxi_board(p_month date default date_trunc('month', now() at time zone 'Europe/Rome')::date)
returns table(org_id uuid, maxi int)
 language sql stable security definer set search_path to 'public' as $$
  select a.org_id, count(*)::int
    from mission_assignments a join missions m on m.id = a.mission_id
   where m.category = 'grande_evento' and m.event_id is null and coalesce(m.venue, '') not in ('AIB', 'PC')
     and a.status <> 'annullata'
     and a.assigned_at >= (p_month::timestamp at time zone 'Europe/Rome')
     and a.assigned_at < ((p_month + interval '1 month')::timestamp at time zone 'Europe/Rome')
   group by a.org_id
$$;
grant execute on function public.maxi_board(date) to authenticated;

create or replace function public.season_prize(p_cat text, p_rank int) returns bigint language sql immutable as $$
  select case when p_cat = 'punti'
    then (array[50000000,40000000,32000000,25000000,20000000,15000000,12000000,10000000,7000000,5000000])[p_rank]
    when p_cat = 'maxi'
    then (array[5000000,4000000,3250000,2500000,2000000,1500000,1250000,1000000,750000,500000])[p_rank]
    else (array[10000000,8000000,6500000,5000000,4000000,3000000,2500000,2000000,1500000,1000000])[p_rank] end::bigint
$$;

alter table public.season_board_cache add column if not exists maxi int not null default 0;
do $$
declare src text; new_src text;
begin
  -- premi
  src := replace(pg_get_functiondef('pay_season_prizes'::regproc), E'\r\n', E'\n');
  if position('maxi_board' in src) = 0 then
    new_src := replace(src, E'  for r in select * from season_prizes where season = p_season loop',
      E'  for r in\n    select ''maxi'' cat, row_number() over (order by maxi desc) rk, org_id, maxi::numeric sc from maxi_board(p_season) where maxi > 0 order by maxi desc limit 10\n  loop\n    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.cat, r.rk::int)); n := n + 1; end loop;\n  for r in select * from season_prizes where season = p_season loop');
    new_src := replace(new_src, $a$"rossi":"Codici rossi"}'$a$, $a$"rossi":"Codici rossi","maxi":"Maxi emergenze"}'$a$);
    if new_src = src or position('maxi_board' in new_src) = 0 then raise exception 'ESITO patch premi non applicata'; end if;
    execute new_src;
  end if;
  -- cache delle classifiche
  src := replace(pg_get_functiondef('refresh_season_cache'::regproc), E'\r\n', E'\n');
  if position('maxi_board' in src) = 0 then
    new_src := replace(src, 'coalesce(r.reds, 0) reds', 'coalesce(r.reds, 0) reds, coalesce(x.maxi, 0) maxi');
    new_src := replace(new_src, 'full join reds_board() r on r.org_id = s.org_id;', 'full join reds_board() r on r.org_id = s.org_id full join maxi_board() x on x.org_id = coalesce(s.org_id, r.org_id);');
    new_src := replace(new_src, 'select coalesce(s.org_id, r.org_id) org_id', 'select coalesce(s.org_id, r.org_id, x.org_id) org_id');
    new_src := replace(new_src, 'insert into season_board_cache(org_id, points, per_vehicle, vehicles, reds, updated_at)', 'insert into season_board_cache(org_id, points, per_vehicle, vehicles, reds, maxi, updated_at)');
    new_src := replace(new_src, 'select org_id, points, per_vehicle, vehicles, reds, now() from _sb', 'select org_id, points, per_vehicle, vehicles, reds, maxi, now() from _sb');
    new_src := replace(new_src, 'reds = excluded.reds, updated_at = now()', 'reds = excluded.reds, maxi = excluded.maxi, updated_at = now()');
    if position('x.maxi' in new_src) = 0 or position('maxi = excluded.maxi' in new_src) = 0 then raise exception 'ESITO patch cache non applicata'; end if;
    execute new_src;
  end if;
  -- fotografie per le frecce
  src := replace(pg_get_functiondef('take_rank_snapshot'::regproc), E'\r\n', E'\n');
  if position('maxi_board' in src) = 0 then
    new_src := replace(src, $a$'reds', rd.reds))$a$, $a$'reds', rd.reds, 'maxi', mx.maxi))$a$);
    new_src := replace(new_src, 'left join reds_board() rd on rd.org_id = l.org_id;', E'left join reds_board() rd on rd.org_id = l.org_id\n    left join maxi_board() mx on mx.org_id = l.org_id;');
    if position('mx.maxi' in new_src) = 0 then raise exception 'ESITO patch fotografie non applicata'; end if;
    execute new_src;
  end if;
end $$;
drop function if exists public.season_board_fast();
create function public.season_board_fast()
returns table(org_id uuid, points numeric, per_vehicle numeric, vehicles int, reds int, maxi int, updated_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select org_id, points, per_vehicle, vehicles, reds, maxi, updated_at from season_board_cache
$$;
grant execute on function public.season_board_fast() to authenticated;
do $$ declare n int; begin n := refresh_season_cache(); raise notice 'ESITO maxi: % in classifica, cache % righe', (select count(*) from season_board_cache where maxi > 0), n; end $$;
