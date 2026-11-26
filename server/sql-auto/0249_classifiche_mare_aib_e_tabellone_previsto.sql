-- 0249: classifiche del mese ⛵ servizi in mare e 🔥 antincendio (premiate, primi 10), e tabellone del torneo visibile prima dell'inizio.

create or replace function public.mare_board(p_month date default date_trunc('month', now() at time zone 'Europe/Rome')::date)
returns table(org_id uuid, mare int)
 language sql stable security definer set search_path to 'public' as $$
  select a.org_id, count(*)::int
    from mission_assignments a join missions m on m.id = a.mission_id
   where m.category = 'mare' and a.status = 'conclusa'
     and a.completed_at >= (p_month::timestamp at time zone 'Europe/Rome')
     and a.completed_at < ((p_month + interval '1 month')::timestamp at time zone 'Europe/Rome')
   group by a.org_id
$$;
create or replace function public.fires_board(p_month date default date_trunc('month', now() at time zone 'Europe/Rome')::date)
returns table(org_id uuid, fires int)
 language sql stable security definer set search_path to 'public' as $$
  select a.org_id, count(*)::int
    from mission_assignments a join missions m on m.id = a.mission_id
   where m.category = 'grande_evento' and m.event_id is null and m.venue = 'AIB'
     and a.status <> 'annullata'
     and a.assigned_at >= (p_month::timestamp at time zone 'Europe/Rome')
     and a.assigned_at < ((p_month + interval '1 month')::timestamp at time zone 'Europe/Rome')
   group by a.org_id
$$;
grant execute on function public.mare_board(date), public.fires_board(date) to authenticated;

-- premi: mare e antincendio sono specialità (servono barche o mezzi AIB): primo 3 milioni, poi a scendere fino al 10°
create or replace function public.season_prize(p_cat text, p_rank int) returns bigint language sql immutable as $$
  select case when p_cat = 'punti'
    then (array[50000000,40000000,32000000,25000000,20000000,15000000,12000000,10000000,7000000,5000000])[p_rank]
    when p_cat = 'maxi'
    then (array[5000000,4000000,3250000,2500000,2000000,1500000,1250000,1000000,750000,500000])[p_rank]
    when p_cat in ('mare', 'incendi')
    then (array[3000000,2400000,1950000,1500000,1200000,900000,750000,600000,450000,300000])[p_rank]
    else (array[10000000,8000000,6500000,5000000,4000000,3000000,2500000,2000000,1500000,1000000])[p_rank] end::bigint
$$;

alter table public.season_board_cache add column if not exists mare int not null default 0;
alter table public.season_board_cache add column if not exists fires int not null default 0;
do $$
declare src text; new_src text;
begin
  -- premi
  src := replace(pg_get_functiondef('pay_season_prizes'::regproc), E'\r\n', E'\n');
  if position('mare_board' in src) = 0 then
    new_src := replace(src, E'  for r in select * from season_prizes where season = p_season loop',
      E'  for r in\n    select ''mare'' cat, row_number() over (order by mare desc) rk, org_id, mare::numeric sc from mare_board(p_season) where mare > 0 order by mare desc limit 10\n  loop\n    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.cat, r.rk::int)); n := n + 1; end loop;\n'
      || E'  for r in\n    select ''incendi'' cat, row_number() over (order by fires desc) rk, org_id, fires::numeric sc from fires_board(p_season) where fires > 0 order by fires desc limit 10\n  loop\n    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.cat, r.rk::int)); n := n + 1; end loop;\n'
      || E'  for r in select * from season_prizes where season = p_season loop');
    new_src := replace(new_src, $a$"maxi":"Maxi emergenze"}'$a$, $a$"maxi":"Maxi emergenze","mare":"Servizi in mare","incendi":"Antincendio"}'$a$);
    if new_src = src or position('fires_board' in new_src) = 0 or position('"incendi":"Antincendio"' in new_src) = 0 then raise exception 'ESITO patch premi non applicata'; end if;
    execute new_src;
  end if;
  -- cache
  src := replace(pg_get_functiondef('refresh_season_cache'::regproc), E'\r\n', E'\n');
  if position('mare_board' in src) = 0 then
    new_src := replace(src, 'coalesce(x.maxi, 0) maxi', 'coalesce(x.maxi, 0) maxi, coalesce(ma.mare, 0) mare, coalesce(fi.fires, 0) fires');
    new_src := replace(new_src, 'full join maxi_board() x on x.org_id = coalesce(s.org_id, r.org_id);',
      'full join maxi_board() x on x.org_id = coalesce(s.org_id, r.org_id) full join mare_board() ma on ma.org_id = coalesce(s.org_id, r.org_id, x.org_id) full join fires_board() fi on fi.org_id = coalesce(s.org_id, r.org_id, x.org_id, ma.org_id);');
    new_src := replace(new_src, 'select coalesce(s.org_id, r.org_id, x.org_id) org_id', 'select coalesce(s.org_id, r.org_id, x.org_id, ma.org_id, fi.org_id) org_id');
    new_src := replace(new_src, 'insert into season_board_cache(org_id, points, per_vehicle, vehicles, reds, maxi, updated_at)', 'insert into season_board_cache(org_id, points, per_vehicle, vehicles, reds, maxi, mare, fires, updated_at)');
    new_src := replace(new_src, 'select org_id, points, per_vehicle, vehicles, reds, maxi, now() from _sb', 'select org_id, points, per_vehicle, vehicles, reds, maxi, mare, fires, now() from _sb');
    new_src := replace(new_src, 'maxi = excluded.maxi, updated_at = now()', 'maxi = excluded.maxi, mare = excluded.mare, fires = excluded.fires, updated_at = now()');
    if position('fi.fires' in new_src) = 0 or position('fires = excluded.fires' in new_src) = 0 or position('ma.org_id, fi.org_id) org_id' in new_src) = 0
      then raise exception 'ESITO patch cache non applicata'; end if;
    execute new_src;
  end if;
  -- fotografie per le frecce
  src := replace(pg_get_functiondef('take_rank_snapshot'::regproc), E'\r\n', E'\n');
  if position('mare_board' in src) = 0 then
    new_src := replace(src, $a$'maxi', mx.maxi))$a$, $a$'maxi', mx.maxi, 'mare', ma.mare, 'fires', fi.fires))$a$);
    new_src := replace(new_src, 'left join maxi_board() mx on mx.org_id = l.org_id;', E'left join maxi_board() mx on mx.org_id = l.org_id\n    left join mare_board() ma on ma.org_id = l.org_id\n    left join fires_board() fi on fi.org_id = l.org_id;');
    if position('fi.fires' in new_src) = 0 then raise exception 'ESITO patch fotografie non applicata'; end if;
    execute new_src;
  end if;
end $$;
drop function if exists public.season_board_fast();
create function public.season_board_fast()
returns table(org_id uuid, points numeric, per_vehicle numeric, vehicles int, reds int, maxi int, mare int, fires int, updated_at timestamptz)
 language sql stable security definer set search_path to 'public' as $$
  select org_id, points, per_vehicle, vehicles, reds, maxi, mare, fires, updated_at from season_board_cache
$$;
grant execute on function public.season_board_fast() to authenticated;

-- ---------- tabellone del torneo visibile prima dell'inizio ----------
create or replace function public.tournament_active_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by rep desc nulls last), '{}') from (
    select o.id, o.reputation rep from organizations o
     where exists (select 1 from mission_assignments a where a.org_id = o.id and a.status = 'conclusa' and a.completed_at > now() - interval '2 days')
     order by o.reputation desc nulls last limit 64) s
$$;

do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('public.tournament_detail(bigint)'::regprocedure), E'\r\n', E'\n');
  if position('tournament_active_ids' in src) > 0 then raise notice 'ESITO anteprima già fatta'; return; end if;
  new_src := replace(src, E'  if t.id is null then return null; end if;\n',
E'  if t.id is null then return null; end if;
  if t.status = ''iscrizioni'' then
    -- tabellone previsto: stesse regole della partenza (attive negli ultimi 2 giorni, teste di serie per reputazione)
    declare ids uuid[] := tournament_active_ids(); n int; sz int; rr int; k int; j int; a uuid; b uuid; acc jsonb := ''[]''::jsonb;
    begin
      n := coalesce(array_length(ids, 1), 0);
      rr := ceil(log(2, greatest(2, n)::numeric))::int; sz := power(2, rr)::int;
      for k in 0..(sz / 2 - 1) loop
        a := ids[k + 1]; b := case when sz - k <= n then ids[sz - k] end;
        acc := acc || jsonb_build_object(''round'', 1, ''slot'', k, ''starts_at'', t.starts_at, ''ends_at'', t.starts_at + interval ''1 hour'', ''done'', false,
          ''winner'', null, ''seed_a'', k + 1, ''seed_b'', case when b is null then null else sz - k end,
          ''a'', (select jsonb_build_object(''id'', id, ''name'', name, ''type'', type::text, ''logo_url'', logo_url) from organizations where id = a),
          ''b'', (select jsonb_build_object(''id'', id, ''name'', name, ''type'', type::text, ''logo_url'', logo_url) from organizations where id = b),
          ''score_a'', null, ''score_b'', null);
      end loop;
      for j in 2..rr loop
        for k in 0..(sz / power(2, j)::int - 1) loop
          acc := acc || jsonb_build_object(''round'', j, ''slot'', k, ''starts_at'', t.starts_at + make_interval(hours => j - 1), ''ends_at'', t.starts_at + make_interval(hours => j),
            ''done'', false, ''winner'', null, ''seed_a'', 0, ''seed_b'', 0, ''a'', null, ''b'', null, ''score_a'', null, ''score_b'', null);
        end loop;
      end loop;
      return jsonb_build_object(''id'', t.id, ''kind'', t.kind, ''title'', t.title, ''status'', t.status, ''starts_at'', t.starts_at, ''rounds'', rr,
        ''size'', sz, ''current_round'', 0, ''prize'', t.base_prize + t.pot, ''entry_fee'', 0, ''me'', my_org_id(), ''preview'', true,
        ''entries'', ''[]''::jsonb, ''matches'', acc);
    end;
  end if;
');
  if new_src = src then raise exception 'ESITO patch anteprima non applicata'; end if;
  execute new_src;
end $$;

do $$
declare n int; d jsonb; t bigint;
begin
  n := refresh_season_cache();
  raise notice 'ESITO cache % righe: mare %, incendi %', n, (select count(*) from season_board_cache where mare > 0), (select count(*) from season_board_cache where fires > 0);
  select id into t from tournaments where status = 'iscrizioni' order by starts_at limit 1;
  if t is not null then
    d := tournament_detail(t);
    raise notice 'ESITO anteprima torneo %: % turni, % incontri', t, d->>'rounds', jsonb_array_length(d->'matches');
  end if;
end $$;
