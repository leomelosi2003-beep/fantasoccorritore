-- 0258: Campionato a serie (A, B, C), così anche le associazioni piccole possono vincere.
-- Ogni torneo (9, 15, 21) si gioca in 3 tabelloni separati: Serie A, Serie B, Serie C.
-- Punti campionato della settimana: torneo vinto 10, finale 5, semifinale 2, ogni incontro vinto 1.
-- Ogni lunedì a mezzanotte: i primi 3 della B salgono in A e i primi 3 della C in B; gli ultimi 3 della A scendono in B e gli ultimi 3 della B in C.
-- Prima divisione: per numero di mezzi (un terzo per serie). Le associazioni nuove partono dalla Serie C.
-- Nessun dato esistente cancellato.

create table if not exists public.org_divisions (
  org_id uuid primary key references public.organizations(id),
  division text not null check (division in ('A','B','C')),
  since timestamptz not null default now()
);
create table if not exists public.division_history (
  week date not null, org_id uuid not null references public.organizations(id),
  from_div text not null, to_div text not null, points int not null, rank int not null,
  primary key (week, org_id)
);
alter table public.org_divisions enable row level security;
alter table public.division_history enable row level security;
drop policy if exists org_divisions_read on public.org_divisions;
create policy org_divisions_read on public.org_divisions for select using (true);
drop policy if exists division_history_read on public.division_history;
create policy division_history_read on public.division_history for select using (true);

alter table public.tournaments add column if not exists division text check (division in ('A','B','C'));
alter table public.tournaments drop constraint if exists tournaments_starts_at_key;
create unique index if not exists tournaments_slot_div_idx on public.tournaments (starts_at, coalesce(division, '-'));

-- prima divisione: per numero di mezzi
insert into org_divisions (org_id, division)
select id, case when rk <= ceil(n / 3.0) then 'A' when rk <= ceil(2 * n / 3.0) then 'B' else 'C' end
  from (select o.id, row_number() over (order by (select count(*) from vehicles v where v.org_id = o.id) desc, o.reputation desc nulls last) rk,
               count(*) over () n
          from organizations o where exists (select 1 from vehicles v where v.org_id = o.id)) x
on conflict (org_id) do nothing;

create or replace function public.org_division(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select division from org_divisions where org_id = p_org), 'C')
$$;
create or replace function public.my_division() returns text
language sql stable security definer set search_path = public as $$ select org_division(my_org_id()) $$;
grant execute on function public.my_division() to authenticated;

-- partecipanti di una serie (con almeno un mezzo)
create or replace function public.tournament_active_ids(p_div text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id order by rep desc nulls last), '{}') from (
    select o.id, o.reputation rep from organizations o
     where exists (select 1 from vehicles v where v.org_id = o.id)
       and (p_div is null or org_division(o.id) = p_div)
     order by o.reputation desc nulls last limit 64) s
$$;

create or replace function public.tournament_auto_entries(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int; room int; v_div text;
begin
  select division into v_div from tournaments where id = p_id;
  select count(*) into n from tournament_entries where tournament_id = p_id;
  room := greatest(0, 64 - n);
  insert into tournament_entries (tournament_id, org_id)
  select p_id, x from unnest(tournament_active_ids(v_div)) x
   where not exists (select 1 from tournament_entries e where e.tournament_id = p_id and e.org_id = x)
   limit room
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.tournament_expected() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(array_length(tournament_active_ids(my_division()), 1), 0)
$$;

-- 3 tabelloni per orario; premi: A 100%, B 70%, C 50% del montepremi base
create or replace function public.tournament_schedule() returns int
language plpgsql security definer set search_path = public as $$
declare d date; h int; ts timestamptz; k text; n int := 0; idx int; dv text; base bigint;
  kinds text[] := array['rossi','gialli','ordinari','verdi']; night text[] := array['rossi','gialli','verdi'];
begin
  for d in select generate_series((now() at time zone 'Europe/Rome')::date, (now() at time zone 'Europe/Rome')::date + 1, interval '1 day')::date loop
    foreach h in array array[9, 15, 21] loop
      ts := (d + make_time(h, 0, 0)) at time zone 'Europe/Rome';
      if ts <= now() or ts > now() + interval '3 hours' then continue; end if;
      idx := (d - date '2026-01-01') * 3 + (h / 6);
      k := case when h = 21 then night[1 + idx % 3] else kinds[1 + idx % 4] end;
      base := case k when 'rossi' then 3000000 when 'gialli' then 2500000 else 2000000 end;
      foreach dv in array array['A','B','C'] loop
        if exists (select 1 from tournaments where starts_at = ts and coalesce(division, '-') = dv) then continue; end if;
        insert into tournaments (kind, title, starts_at, base_prize, division, entry_fee)
        values (k, format('Serie %s · %s delle %s', dv, contest_kind_label(k), h), ts,
                round(base * case dv when 'A' then 1 when 'B' then 0.7 else 0.5 end)::bigint, dv, 0);
        n := n + 1;
      end loop;
    end loop;
  end loop;
  return n;
end $$;

-- anteprima e "il mio torneo" con la serie giusta
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('public.tournament_detail(bigint)'::regprocedure), E'\r\n', E'\n');
  if position('tournament_active_ids(t.division)' in src) = 0 then
    new_src := replace(src, 'tournament_active_ids()', 'tournament_active_ids(t.division)');
    if new_src = src then raise exception 'ESITO patch anteprima non applicata'; end if;
    new_src := replace(new_src, $a$jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'rounds', t.rounds,$a$,
                                $a$jsonb_build_object('id', t.id, 'division', t.division, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'rounds', t.rounds,$a$);
    execute new_src;
  end if;
  src := replace(pg_get_functiondef('public.my_tournament_status()'::regprocedure), E'\r\n', E'\n');
  if position('my_division()' in src) = 0 then
    new_src := replace(src, 'tournament_active_ids()', 'tournament_active_ids(t.division)');
    new_src := replace(new_src, $a$select * into t from tournaments where status = 'in_corso' order by starts_at limit 1;$a$,
      $a$select * into t from tournaments where status = 'in_corso' and (exists (select 1 from tournament_entries e where e.tournament_id = tournaments.id and e.org_id = me)) order by starts_at limit 1;
  if t.id is null then select * into t from tournaments where status = 'in_corso' and coalesce(division, my_division()) = my_division() order by starts_at limit 1; end if;$a$);
    new_src := replace(new_src, $a$select * into t from tournaments where status = 'iscrizioni' order by starts_at limit 1; end if;$a$,
      $a$select * into t from tournaments where status = 'iscrizioni' and coalesce(division, my_division()) = my_division() order by starts_at limit 1; end if;$a$);
    if position('coalesce(division, my_division()) = my_division()' in new_src) = 0 or position('tournament_active_ids(t.division)' in new_src) = 0 then
      raise exception 'ESITO patch mio torneo non applicata'; end if;
    new_src := replace(new_src, $a$return jsonb_build_object('id', t.id, 'kind', t.kind,$a$, $a$return jsonb_build_object('id', t.id, 'division', t.division, 'kind', t.kind,$a$);
    execute new_src;
  end if;
end $$;

-- elenco tornei con la serie
create or replace function public.tournaments_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'starts_at' desc, x->>'division'), '[]'::jsonb) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'division', t.division,
      'ends_at', t.starts_at + make_interval(hours => coalesce(t.rounds, 5)), 'rounds', t.rounds, 'current_round', t.current_round,
      'entry_fee', t.entry_fee, 'prize', t.base_prize + t.pot,
      'entries', (select count(*) from tournament_entries e where e.tournament_id = t.id),
      'joined', exists (select 1 from tournament_entries e where e.tournament_id = t.id and e.org_id = my_org_id()),
      'my_out', (select out_round from tournament_entries e where e.tournament_id = t.id and e.org_id = my_org_id()),
      'winner', (select name from organizations where id = t.winner_org)) x
    from tournaments t where t.starts_at > now() - interval '2 days' order by t.starts_at desc limit 40) s
$$;

-- punti campionato in un periodo, per serie
create or replace function public.division_points(p_from timestamptz, p_to timestamptz)
returns table(org_id uuid, points int, wins int, finals int, matches_won int)
language sql stable security definer set search_path = public as $$
  with fin as (select id, rounds, winner_org, runner_org from tournaments
                where status = 'finito' and division is not null and starts_at >= p_from and starts_at < p_to),
  semi as (select case when m.winner_org = m.org_a then m.org_b else m.org_a end org_id
             from tournament_matches m join fin on fin.id = m.tournament_id
            where fin.rounds >= 2 and m.round = fin.rounds - 1 and m.org_b is not null),
  mw as (select m.winner_org org_id from tournament_matches m join tournaments t on t.id = m.tournament_id
          where t.division is not null and t.starts_at >= p_from and t.starts_at < p_to and m.done and m.org_b is not null),
  p as (select winner_org org_id, 10 pt, 1 w, 0 f, 0 mwn from fin
        union all select runner_org, 5, 0, 1, 0 from fin where runner_org is not null
        union all select org_id, 2, 0, 0, 0 from semi
        union all select org_id, 1, 0, 0, 1 from mw)
  select org_id, sum(pt)::int, sum(w)::int, sum(f)::int, sum(mwn)::int from p where org_id is not null group by org_id
$$;

create or replace function public.week_start(p_ts timestamptz default now()) returns timestamptz
language sql stable as $$ select (date_trunc('week', p_ts at time zone 'Europe/Rome')) at time zone 'Europe/Rome' $$;

-- classifica della mia serie (o di una serie scelta) nella settimana in corso
create or replace function public.division_standings(p_div text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_div, my_division()) dv),
  members as (select o.id, o.name, o.type::text type, o.logo_url, o.reputation from organizations o, d
               where exists (select 1 from vehicles v where v.org_id = o.id) and org_division(o.id) = d.dv),
  pts as (select * from division_points(week_start(), week_start() + interval '7 days'))
  select jsonb_build_object('division', (select dv from d), 'mine', my_division(), 'week_ends', week_start() + interval '7 days',
    'size', (select count(*) from members),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'type', m.type, 'logo_url', m.logo_url,
        'points', coalesce(p.points, 0), 'wins', coalesce(p.wins, 0), 'finals', coalesce(p.finals, 0), 'matches', coalesce(p.matches_won, 0),
        'me', m.id = my_org_id()) order by coalesce(p.points, 0) desc, coalesce(p.wins, 0) desc, m.reputation desc nulls last)
      from members m left join pts p on p.org_id = m.id), '[]'::jsonb))
$$;
grant execute on function public.division_standings(text) to authenticated;

-- fine settimana: promozioni e retrocessioni (3 su e 3 giù tra A-B e tra B-C)
create or replace function public.division_rollover() returns int
language plpgsql security definer set search_path = public as $$
declare wk timestamptz := week_start() - interval '7 days'; n int := 0; r record; moved uuid[] := '{}';
begin
  if exists (select 1 from division_history where week = (wk at time zone 'Europe/Rome')::date) then return 0; end if;
  insert into org_divisions (org_id, division)
    select o.id, 'C' from organizations o where exists (select 1 from vehicles v where v.org_id = o.id) on conflict do nothing;
  for r in
    with pts as (select * from division_points(wk, wk + interval '7 days')),
    ranked as (
      select d.org_id, d.division, coalesce(p.points, 0) points,
             row_number() over (partition by d.division order by coalesce(p.points, 0) desc, coalesce(p.wins, 0) desc, o.reputation desc nulls last) rk_top,
             row_number() over (partition by d.division order by coalesce(p.points, 0) asc, coalesce(p.wins, 0) asc, o.reputation asc nulls first) rk_bot
        from org_divisions d join organizations o on o.id = d.org_id
       where exists (select 1 from vehicles v where v.org_id = d.org_id))
    select org_id, division, points, rk_top,
           case when division = 'B' and rk_top <= 3 then 'A' when division = 'C' and rk_top <= 3 then 'B'
                when division = 'A' and rk_bot <= 3 then 'B' when division = 'B' and rk_bot <= 3 and rk_top > 3 then 'C'
                else division end to_div
      from ranked
  loop
    insert into division_history values ((wk at time zone 'Europe/Rome')::date, r.org_id, r.division, r.to_div, r.points, r.rk_top) on conflict do nothing;
    if r.to_div <> r.division then
      execute 'up'||'date org_divisions set division = $1, since = now() where org_id = $2' using r.to_div, r.org_id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.division_rollover(), public.division_points(timestamptz, timestamptz) from public, anon, authenticated;

-- le associazioni nuove entrano in Serie C da sole (al primo mezzo)
create or replace function public.vehicles_default_division() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into org_divisions (org_id, division) values (new.org_id, 'C') on conflict do nothing;
  return new;
end $$;
drop trigger if exists vehicles_default_division on public.vehicles;
create trigger vehicles_default_division after insert on public.vehicles for each row execute function public.vehicles_default_division();

-- i tornei di oggi non ancora iniziati diventano a serie
do $$
declare t record; dv text;
begin
  for t in select * from tournaments where status = 'iscrizioni' and division is null loop
    execute 'up'||'date tournaments set division = ''A'', title = $1, base_prize = $2 where id = $3'
      using format('Serie A · %s delle %s', contest_kind_label(t.kind), extract(hour from t.starts_at at time zone 'Europe/Rome')::int), t.base_prize, t.id;
    foreach dv in array array['B','C'] loop
      insert into tournaments (kind, title, starts_at, base_prize, division, entry_fee)
      values (t.kind, format('Serie %s · %s delle %s', dv, contest_kind_label(t.kind), extract(hour from t.starts_at at time zone 'Europe/Rome')::int), t.starts_at,
              round(t.base_prize * case dv when 'B' then 0.7 else 0.5 end)::bigint, dv, 0)
      on conflict do nothing;
    end loop;
  end loop;
  raise notice 'ESITO serie: A %, B %, C %', (select count(*) from org_divisions where division = 'A'), (select count(*) from org_divisions where division = 'B'),
    (select count(*) from org_divisions where division = 'C');
  raise notice 'ESITO tornei in programma: %', (select string_agg(title, ' | ') from tournaments where status = 'iscrizioni');
end $$;
