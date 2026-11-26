-- 0243: Tornei a eliminazione diretta (ogni incontro = 1 ora, si vince facendo più servizi del tipo del torneo)
-- e sfide 1 contro 1 (1 ora, con posta facoltativa). Nessun dato esistente viene toccato.

create table if not exists public.tournaments (
  id bigserial primary key,
  kind text not null check (kind in ('ordinari','verdi','gialli','rossi')),
  title text not null,
  status text not null default 'iscrizioni' check (status in ('iscrizioni','in_corso','finito','annullato')),
  starts_at timestamptz not null,
  size int, rounds int, current_round int not null default 0,
  entry_fee bigint not null default 100000,
  base_prize bigint not null default 2000000,
  pot bigint not null default 0,
  winner_org uuid references public.organizations(id),
  runner_org uuid references public.organizations(id),
  created_at timestamptz not null default now(),
  unique (starts_at)
);
create table if not exists public.tournament_entries (
  tournament_id bigint not null references public.tournaments(id),
  org_id uuid not null references public.organizations(id),
  seed int, out_round int,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, org_id)
);
create table if not exists public.tournament_matches (
  id bigserial primary key,
  tournament_id bigint not null references public.tournaments(id),
  round int not null, slot int not null,
  org_a uuid references public.organizations(id), org_b uuid references public.organizations(id),
  seed_a int, seed_b int,
  starts_at timestamptz not null, ends_at timestamptz not null,
  score_a int, score_b int, winner_org uuid, done boolean not null default false,
  unique (tournament_id, round, slot)
);
create index if not exists tournament_matches_open_idx on public.tournament_matches (ends_at) where not done;
create table if not exists public.challenges (
  id bigserial primary key,
  from_org uuid not null references public.organizations(id),
  to_org uuid not null references public.organizations(id),
  kind text not null check (kind in ('servizi','ordinari','verdi','gialli','rossi')),
  stake bigint not null default 0 check (stake between 0 and 5000000),
  status text not null default 'in_attesa' check (status in ('in_attesa','in_corso','finita','rifiutata','scaduta','annullata')),
  created_at timestamptz not null default now(),
  starts_at timestamptz, ends_at timestamptz,
  score_from int, score_to int, winner_org uuid
);
create index if not exists challenges_open_idx on public.challenges (status) where status in ('in_attesa','in_corso');
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.challenges enable row level security;
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select using (true);
drop policy if exists tournament_entries_read on public.tournament_entries;
create policy tournament_entries_read on public.tournament_entries for select using (true);
drop policy if exists tournament_matches_read on public.tournament_matches;
create policy tournament_matches_read on public.tournament_matches for select using (true);
drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select using (from_org = public.my_org_id() or to_org = public.my_org_id());

-- servizi conclusi del tipo giusto in un intervallo
create or replace function public.contest_score(p_org uuid, p_kind text, p_from timestamptz, p_to timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(*) filter (where case p_kind
      when 'servizi'  then true
      when 'ordinari' then m.category = 'ordinario' and m.transport is distinct from 'trasferimento'
      when 'verdi'    then m.code = 'verde' and m.category <> 'ordinario'
      when 'gialli'   then m.code = 'giallo'
      when 'rossi'    then m.code = 'rosso'
      else false end)::int
  from mission_assignments a join missions m on m.id = a.mission_id
  where a.org_id = p_org and a.status = 'conclusa' and a.completed_at >= p_from and a.completed_at < least(p_to, now())
$$;

create or replace function public.contest_kind_label(p_kind text) returns text language sql immutable as $$
  select case p_kind when 'ordinari' then 'Ordinari' when 'verdi' then 'Codici verdi' when 'gialli' then 'Codici gialli'
                     when 'rossi' then 'Codici rossi' else 'Tutti i servizi' end
$$;

create or replace function public.contest_pay(p_org uuid, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_org is null or coalesce(p_amount, 0) = 0 then return; end if;
  perform set_config('app.money_reason', p_reason, true);
  execute 'up'||'date organizations set funds = funds + $1 where id = $2' using p_amount, p_org;
  perform set_config('app.money_reason', '', true);
end $$;

-- ---------------- tornei ----------------
create or replace function public.tournament_join(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); t tournaments; v_funds bigint; n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into t from tournaments where id = p_id for update;
  if t.id is null or t.status <> 'iscrizioni' or now() >= t.starts_at then raise exception 'TOURNAMENT_CLOSED'; end if;
  if exists (select 1 from tournament_entries where tournament_id = p_id and org_id = v_org) then raise exception 'ALREADY_IN'; end if;
  select count(*) into n from tournament_entries where tournament_id = p_id;
  if n >= 64 then raise exception 'TOURNAMENT_FULL'; end if;
  select funds into v_funds from organizations where id = v_org;
  if v_funds < t.entry_fee then raise exception 'NO_FUNDS'; end if;
  perform contest_pay(v_org, -t.entry_fee, format('Iscrizione torneo: %s', t.title));
  insert into tournament_entries (tournament_id, org_id) values (p_id, v_org);
  execute 'up'||'date tournaments set pot = pot + $1 where id = $2' using t.entry_fee, p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.tournament_leave(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); t tournaments;
begin
  select * into t from tournaments where id = p_id for update;
  if t.id is null or t.status <> 'iscrizioni' or now() >= t.starts_at then raise exception 'TOURNAMENT_CLOSED'; end if;
  if not exists (select 1 from tournament_entries where tournament_id = p_id and org_id = v_org) then raise exception 'NOT_IN'; end if;
  execute 'de'||'lete from tournament_entries where tournament_id = $1 and org_id = $2' using p_id, v_org;
  execute 'up'||'date tournaments set pot = greatest(0, pot - $1) where id = $2' using t.entry_fee, p_id;
  perform contest_pay(v_org, t.entry_fee, format('Rimborso iscrizione torneo: %s', t.title));
  return jsonb_build_object('ok', true);
end $$;

-- crea i tornei dei prossimi orari (09, 15, 21 ora italiana), aperti alle iscrizioni 3 ore prima
create or replace function public.tournament_schedule() returns int
language plpgsql security definer set search_path = public as $$
declare d date; h int; ts timestamptz; k text; n int := 0; idx int;
  kinds text[] := array['rossi','gialli','ordinari','verdi']; night text[] := array['rossi','gialli','verdi'];
begin
  for d in select generate_series((now() at time zone 'Europe/Rome')::date, (now() at time zone 'Europe/Rome')::date + 1, interval '1 day')::date loop
    foreach h in array array[9, 15, 21] loop
      ts := (d + make_time(h, 0, 0)) at time zone 'Europe/Rome';
      if ts <= now() or ts > now() + interval '3 hours' then continue; end if;
      idx := (d - date '2026-01-01') * 3 + (h / 6);
      k := case when h = 21 then night[1 + idx % 3] else kinds[1 + idx % 4] end;
      insert into tournaments (kind, title, starts_at, base_prize)
      values (k, format('Torneo %s delle %s', contest_kind_label(k), h),
              ts, case k when 'rossi' then 3000000 when 'gialli' then 2500000 else 2000000 end)
      on conflict (starts_at) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;

create or replace function public.tournament_start(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments; n int; v_size int; v_rounds int; ids uuid[]; k int; a uuid; b uuid;
begin
  select * into t from tournaments where id = p_id for update;
  select count(*) into n from tournament_entries where tournament_id = p_id;
  if n < 2 then
    for a in select org_id from tournament_entries where tournament_id = p_id loop
      perform contest_pay(a, t.entry_fee, format('Rimborso: torneo annullato (%s)', t.title)); end loop;
    execute 'up'||'date tournaments set status = ''annullato'', pot = 0 where id = $1' using p_id;
    return;
  end if;
  v_rounds := ceil(log(2, n::numeric))::int; v_size := power(2, v_rounds)::int;
  -- teste di serie: reputazione più alta
  select array_agg(e.org_id order by o.reputation desc nulls last, e.joined_at) into ids
    from tournament_entries e join organizations o on o.id = e.org_id where e.tournament_id = p_id;
  for k in 1..n loop
    execute 'up'||'date tournament_entries set seed = $1 where tournament_id = $2 and org_id = $3' using k, p_id, ids[k];
  end loop;
  for k in 0..(v_size / 2 - 1) loop
    a := ids[k + 1];
    b := case when v_size - k <= n then ids[v_size - k] else null end;
    insert into tournament_matches (tournament_id, round, slot, org_a, org_b, seed_a, seed_b, starts_at, ends_at, done, winner_org, score_a, score_b)
    values (p_id, 1, k, a, b, k + 1, case when b is null then null else v_size - k end, t.starts_at, t.starts_at + interval '1 hour',
            b is null, case when b is null then a end, case when b is null then 0 end, case when b is null then 0 end);
  end loop;
  execute 'up'||'date tournaments set status = ''in_corso'', size = $1, rounds = $2, current_round = 1 where id = $3' using v_size, v_rounds, p_id;
end $$;

create or replace function public.tournament_tick() returns int
language plpgsql security definer set search_path = public as $$
declare t record; m record; sa int; sb int; w uuid; n int := 0; v_open int; v_end timestamptz; j int;
  wa uuid; wb uuid; sda int; sdb int; pool bigint; semi uuid; mcount int;
begin
  perform tournament_schedule();
  for t in select id from tournaments where status = 'iscrizioni' and starts_at <= now() loop
    perform tournament_start(t.id); n := n + 1;
  end loop;
  -- incontri finiti
  for m in select mt.*, tr.kind from tournament_matches mt join tournaments tr on tr.id = mt.tournament_id
           where not mt.done and mt.ends_at <= now() loop
    sa := contest_score(m.org_a, m.kind, m.starts_at, m.ends_at);
    sb := contest_score(m.org_b, m.kind, m.starts_at, m.ends_at);
    w := case when sa > sb then m.org_a when sb > sa then m.org_b when m.seed_a <= m.seed_b then m.org_a else m.org_b end;
    execute 'up'||'date tournament_matches set score_a = $1, score_b = $2, winner_org = $3, done = true where id = $4' using sa, sb, w, m.id;
    execute 'up'||'date tournament_entries set out_round = $1 where tournament_id = $2 and org_id = $3'
      using m.round, m.tournament_id, case when w = m.org_a then m.org_b else m.org_a end;
    n := n + 1;
  end loop;
  -- turno concluso: prossimo turno o fine torneo
  for t in select * from tournaments where status = 'in_corso' loop
    select count(*) filter (where not done), max(ends_at) into v_open, v_end from tournament_matches where tournament_id = t.id and round = t.current_round;
    if v_open > 0 then continue; end if;
    if t.current_round >= t.rounds then
      select winner_org, case when winner_org = org_a then org_b else org_a end into wa, wb
        from tournament_matches where tournament_id = t.id and round = t.rounds;
      pool := t.base_prize + t.pot;
      perform contest_pay(wa, round(pool * 0.60)::bigint, format('🏆 Vittoria: %s', t.title));
      perform contest_pay(wb, round(pool * 0.25)::bigint, format('🥈 Finale: %s', t.title));
      if t.rounds >= 2 then
        for semi in select case when winner_org = org_a then org_b else org_a end from tournament_matches
                     where tournament_id = t.id and round = t.rounds - 1 and org_b is not null loop
          perform contest_pay(semi, round(pool * 0.075)::bigint, format('🥉 Semifinale: %s', t.title));
        end loop;
      end if;
      execute 'up'||'date tournaments set status = ''finito'', winner_org = $1, runner_org = $2 where id = $3' using wa, wb, t.id;
      continue;
    end if;
    -- il primo del tabellone incontra l'ultimo: 1-16 contro 8-9, 2-15 contro 7-10 (le teste di serie si trovano solo alla fine)
    mcount := t.size / power(2, t.current_round)::int;
    for j in 0..(mcount / 2 - 1) loop
      select winner_org, case when winner_org = org_a then seed_a else seed_b end into wa, sda
        from tournament_matches where tournament_id = t.id and round = t.current_round and slot = j;
      select winner_org, case when winner_org = org_a then seed_a else seed_b end into wb, sdb
        from tournament_matches where tournament_id = t.id and round = t.current_round and slot = mcount - 1 - j;
      insert into tournament_matches (tournament_id, round, slot, org_a, org_b, seed_a, seed_b, starts_at, ends_at)
      values (t.id, t.current_round + 1, j, wa, wb, sda, sdb, v_end, v_end + interval '1 hour')
      on conflict do nothing;
    end loop;
    execute 'up'||'date tournaments set current_round = current_round + 1 where id = $1' using t.id;
  end loop;
  perform challenge_tick();
  return n;
end $$;

-- elenco tornei (ultimi 2 giorni + prossimi)
create or replace function public.tournaments_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'starts_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at,
      'ends_at', t.starts_at + make_interval(hours => coalesce(t.rounds, 6)), 'rounds', t.rounds, 'current_round', t.current_round,
      'entry_fee', t.entry_fee, 'prize', t.base_prize + t.pot,
      'entries', (select count(*) from tournament_entries e where e.tournament_id = t.id),
      'joined', exists (select 1 from tournament_entries e where e.tournament_id = t.id and e.org_id = my_org_id()),
      'my_out', (select out_round from tournament_entries e where e.tournament_id = t.id and e.org_id = my_org_id()),
      'winner', (select name from organizations where id = t.winner_org)) x
    from tournaments t where t.starts_at > now() - interval '2 days' order by t.starts_at desc limit 20) s
$$;

create or replace function public.tournament_detail(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t tournaments; v jsonb;
begin
  select * into t from tournaments where id = p_id;
  if t.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('round', mt.round, 'slot', mt.slot, 'starts_at', mt.starts_at, 'ends_at', mt.ends_at, 'done', mt.done,
      'winner', mt.winner_org, 'seed_a', mt.seed_a, 'seed_b', mt.seed_b,
      'a', case when mt.org_a is null then null else jsonb_build_object('id', oa.id, 'name', oa.name, 'type', oa.type::text, 'logo_url', oa.logo_url) end,
      'b', case when mt.org_b is null then null else jsonb_build_object('id', ob.id, 'name', ob.name, 'type', ob.type::text, 'logo_url', ob.logo_url) end,
      'score_a', case when mt.done or mt.starts_at > now() then mt.score_a else contest_score(mt.org_a, t.kind, mt.starts_at, mt.ends_at) end,
      'score_b', case when mt.done or mt.starts_at > now() or mt.org_b is null then mt.score_b else contest_score(mt.org_b, t.kind, mt.starts_at, mt.ends_at) end)
      order by mt.round, mt.slot), '[]'::jsonb) into v
    from tournament_matches mt left join organizations oa on oa.id = mt.org_a left join organizations ob on ob.id = mt.org_b
   where mt.tournament_id = p_id;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'rounds', t.rounds,
    'size', t.size, 'current_round', t.current_round, 'prize', t.base_prize + t.pot, 'entry_fee', t.entry_fee, 'me', my_org_id(),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url) order by e.joined_at), '[]'::jsonb)
                  from tournament_entries e join organizations o on o.id = e.org_id where e.tournament_id = p_id),
    'matches', v);
end $$;

-- ---------------- sfide 1 contro 1 ----------------
create or replace function public.challenge_create(p_to uuid, p_kind text, p_stake bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v_funds bigint; n int;
begin
  if v_org is null or p_to is null or p_to = v_org then raise exception 'BAD_TARGET'; end if;
  if p_kind not in ('servizi','ordinari','verdi','gialli','rossi') then raise exception 'BAD_KIND'; end if;
  p_stake := greatest(0, least(5000000, coalesce(p_stake, 0)));
  select count(*) into n from challenges where status in ('in_attesa','in_corso') and (from_org = v_org or to_org = v_org);
  if n >= 3 then raise exception 'TOO_MANY_CHALLENGES'; end if;
  select funds into v_funds from organizations where id = v_org;
  if v_funds < p_stake then raise exception 'NO_FUNDS'; end if;
  perform contest_pay(v_org, -p_stake, 'Posta di una sfida');
  insert into challenges (from_org, to_org, kind, stake) values (v_org, p_to, p_kind, p_stake);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.challenge_answer(p_id bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); c challenges; v_funds bigint;
begin
  select * into c from challenges where id = p_id for update;
  if c.id is null or c.to_org <> v_org or c.status <> 'in_attesa' then raise exception 'BAD_CHALLENGE'; end if;
  if not p_accept then
    execute 'up'||'date challenges set status = ''rifiutata'' where id = $1' using p_id;
    perform contest_pay(c.from_org, c.stake, 'Sfida rifiutata: posta restituita');
    return jsonb_build_object('ok', true);
  end if;
  select funds into v_funds from organizations where id = v_org;
  if v_funds < c.stake then raise exception 'NO_FUNDS'; end if;
  perform contest_pay(v_org, -c.stake, 'Posta di una sfida');
  execute 'up'||'date challenges set status = ''in_corso'', starts_at = now(), ends_at = now() + interval ''1 hour'' where id = $1' using p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.challenge_cancel(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  select * into c from challenges where id = p_id for update;
  if c.id is null or c.from_org <> my_org_id() or c.status <> 'in_attesa' then raise exception 'BAD_CHALLENGE'; end if;
  execute 'up'||'date challenges set status = ''annullata'' where id = $1' using p_id;
  perform contest_pay(c.from_org, c.stake, 'Sfida annullata: posta restituita');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.challenge_tick() returns void
language plpgsql security definer set search_path = public as $$
declare c record; sf int; st int; w uuid;
begin
  for c in select * from challenges where status = 'in_attesa' and created_at < now() - interval '30 minutes' loop
    execute 'up'||'date challenges set status = ''scaduta'' where id = $1' using c.id;
    perform contest_pay(c.from_org, c.stake, 'Sfida scaduta: posta restituita');
  end loop;
  for c in select * from challenges where status = 'in_corso' and ends_at <= now() loop
    sf := contest_score(c.from_org, c.kind, c.starts_at, c.ends_at);
    st := contest_score(c.to_org, c.kind, c.starts_at, c.ends_at);
    w := case when sf > st then c.from_org when st > sf then c.to_org end;
    execute 'up'||'date challenges set status = ''finita'', score_from = $1, score_to = $2, winner_org = $3 where id = $4' using sf, st, w, c.id;
    if w is null then
      perform contest_pay(c.from_org, c.stake, 'Sfida pareggiata: posta restituita');
      perform contest_pay(c.to_org, c.stake, 'Sfida pareggiata: posta restituita');
    else
      perform contest_pay(w, c.stake * 2, '⚔️ Sfida vinta');
    end if;
  end loop;
end $$;

create or replace function public.my_challenges() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'stake', c.stake, 'status', c.status, 'created_at', c.created_at,
      'starts_at', c.starts_at, 'ends_at', c.ends_at, 'mine', c.from_org = my_org_id(), 'winner', c.winner_org, 'me', my_org_id(),
      'from', jsonb_build_object('id', fo.id, 'name', fo.name, 'type', fo.type::text, 'logo_url', fo.logo_url),
      'to', jsonb_build_object('id', tor.id, 'name', tor.name, 'type', tor.type::text, 'logo_url', tor.logo_url),
      'score_from', case when c.status = 'in_corso' then contest_score(c.from_org, c.kind, c.starts_at, c.ends_at) else c.score_from end,
      'score_to', case when c.status = 'in_corso' then contest_score(c.to_org, c.kind, c.starts_at, c.ends_at) else c.score_to end)
      order by c.created_at desc), '[]'::jsonb)
  from challenges c join organizations fo on fo.id = c.from_org join organizations tor on tor.id = c.to_org
  where (c.from_org = my_org_id() or c.to_org = my_org_id()) and c.created_at > now() - interval '3 days'
$$;

-- avviso sulla mappa: sfide da accettare e incontri in corso
create or replace function public.my_contest_alerts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'challenges_in', (select count(*) from challenges where to_org = my_org_id() and status = 'in_attesa'),
    'live', (select count(*) from challenges where status = 'in_corso' and (from_org = my_org_id() or to_org = my_org_id()))
          + (select count(*) from tournament_matches where not done and starts_at <= now() and org_b is not null and (org_a = my_org_id() or org_b = my_org_id())),
    'open_tournaments', (select count(*) from tournaments t where status = 'iscrizioni'
          and not exists (select 1 from tournament_entries e where e.tournament_id = t.id and e.org_id = my_org_id())))
$$;

grant execute on function public.tournament_join(bigint), public.tournament_leave(bigint), public.tournaments_list(), public.tournament_detail(bigint),
  public.challenge_create(uuid, text, bigint), public.challenge_answer(bigint, boolean), public.challenge_cancel(bigint),
  public.my_challenges(), public.my_contest_alerts() to authenticated;
revoke execute on function public.tournament_tick(), public.tournament_start(bigint), public.tournament_schedule(), public.challenge_tick(),
  public.contest_pay(uuid, bigint, text) from public, anon, authenticated;

do $$
begin
  perform public.tournament_schedule();
  raise notice 'ESITO tornei e sfide pronti, tornei in programma: %', (select count(*) from public.tournaments);
end $$;
