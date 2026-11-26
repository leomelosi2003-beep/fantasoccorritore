-- 0251: classifica del mese 🦺 Protezione Civile (mezzi mandati sulle missioni PC), premiata ai primi 10 come mare e antincendio.
create or replace function public.pc_board(p_month date default date_trunc('month', now() at time zone 'Europe/Rome')::date)
returns table(org_id uuid, pc int)
 language sql stable security definer set search_path to 'public' as $$
  select a.org_id, count(*)::int
    from mission_assignments a join missions m on m.id = a.mission_id
   where m.category = 'grande_evento' and m.event_id is null and m.venue = 'PC'
     and a.status <> 'annullata'
     and a.assigned_at >= (p_month::timestamp at time zone 'Europe/Rome')
     and a.assigned_at < ((p_month + interval '1 month')::timestamp at time zone 'Europe/Rome')
   group by a.org_id
$$;
grant execute on function public.pc_board(date) to authenticated;

create or replace function public.season_prize(p_cat text, p_rank int) returns bigint language sql immutable as $$
  select case when p_cat = 'punti'
    then (array[50000000,40000000,32000000,25000000,20000000,15000000,12000000,10000000,7000000,5000000])[p_rank]
    when p_cat = 'maxi'
    then (array[5000000,4000000,3250000,2500000,2000000,1500000,1250000,1000000,750000,500000])[p_rank]
    when p_cat in ('mare', 'incendi', 'pc')
    then (array[3000000,2400000,1950000,1500000,1200000,900000,750000,600000,450000,300000])[p_rank]
    else (array[10000000,8000000,6500000,5000000,4000000,3000000,2500000,2000000,1500000,1000000])[p_rank] end::bigint
$$;

alter table public.season_board_cache add column if not exists pc int not null default 0;
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('pay_season_prizes'::regproc), E'\r\n', E'\n');
  if position('pc_board' in src) = 0 then
    new_src := replace(src, E'  for r in select * from season_prizes where season = p_season loop',
      E'  for r in\n    select ''pc'' cat, row_number() over (order by pc desc) rk, org_id, pc::numeric sc from pc_board(p_season) where pc > 0 order by pc desc limit 10\n  loop\n    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.cat, r.rk::int)); n := n + 1; end loop;\n'
      || E'  for r in select * from season_prizes where season = p_season loop');
    new_src := replace(new_src, $a$"incendi":"Antincendio"}'$a$, $a$"incendi":"Antincendio","pc":"Protezione Civile"}'$a$);
    if new_src = src or position('"pc":"Protezione Civile"' in new_src) = 0 then raise exception 'ESITO patch premi non applicata'; end if;
    execute new_src;
  end if;
  src := replace(pg_get_functiondef('refresh_season_cache'::regproc), E'\r\n', E'\n');
  if position('pc_board' in src) = 0 then
    new_src := replace(src, 'coalesce(fi.fires, 0) fires', 'coalesce(fi.fires, 0) fires, coalesce(pc.pc, 0) pc');
    new_src := replace(new_src, 'full join fires_board() fi on fi.org_id = coalesce(s.org_id, r.org_id, x.org_id, ma.org_id);',
      'full join fires_board() fi on fi.org_id = coalesce(s.org_id, r.org_id, x.org_id, ma.org_id) full join pc_board() pc on pc.org_id = coalesce(s.org_id, r.org_id, x.org_id, ma.org_id, fi.org_id);');
    new_src := replace(new_src, 'select coalesce(s.org_id, r.org_id, x.org_id, ma.org_id, fi.org_id) org_id', 'select coalesce(s.org_id, r.org_id, x.org_id, ma.org_id, fi.org_id, pc.org_id) org_id');
    new_src := replace(new_src, 'reds, maxi, mare, fires, updated_at)', 'reds, maxi, mare, fires, pc, updated_at)');
    new_src := replace(new_src, 'reds, maxi, mare, fires, now() from _sb', 'reds, maxi, mare, fires, pc, now() from _sb');
    new_src := replace(new_src, 'fires = excluded.fires, updated_at = now()', 'fires = excluded.fires, pc = excluded.pc, updated_at = now()');
    if position('pc.pc' in new_src) = 0 or position('pc = excluded.pc' in new_src) = 0 or position('fi.org_id, pc.org_id) org_id' in new_src) = 0
       or position('fires, pc, now()' in new_src) = 0 then raise exception 'ESITO patch cache non applicata'; end if;
    execute new_src;
  end if;
  src := replace(pg_get_functiondef('take_rank_snapshot'::regproc), E'\r\n', E'\n');
  if position('pc_board' in src) = 0 then
    new_src := replace(src, $a$'fires', fi.fires))$a$, $a$'fires', fi.fires, 'pc', pcb.pc))$a$);
    new_src := replace(new_src, 'left join fires_board() fi on fi.org_id = l.org_id;', E'left join fires_board() fi on fi.org_id = l.org_id\n    left join pc_board() pcb on pcb.org_id = l.org_id;');
    if position('pcb.pc' in new_src) = 0 then raise exception 'ESITO patch fotografie non applicata'; end if;
    execute new_src;
  end if;
end $$;
drop function if exists public.season_board_fast();
create function public.season_board_fast()
returns table(org_id uuid, points numeric, per_vehicle numeric, vehicles int, reds int, maxi int, mare int, fires int, pc int, updated_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select org_id, points, per_vehicle, vehicles, reds, maxi, mare, fires, pc, updated_at from season_board_cache
$$;
grant execute on function public.season_board_fast() to authenticated;
do $$ declare n int; begin n := refresh_season_cache(); raise notice 'ESITO protezione civile: % in classifica', (select count(*) from season_board_cache where pc > 0); end $$;
