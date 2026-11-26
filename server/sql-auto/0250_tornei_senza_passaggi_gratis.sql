-- 0250: tornei senza tutti quei "passa il turno". Prima il tabellone era a potenza di 2 (19 squadre -> 32 posti -> 13 passaggi gratis).
-- Ora: al primo turno giocano tutti; solo se sono dispari la testa di serie n.1 passa da sola (al massimo 1).
-- Nei turni dopo, se i vincitori sono dispari viene RIPESCATO il miglior perdente (quello che ha fatto più servizi), così nessuno passa gratis.
-- Accoppiamenti: la migliore testa di serie rimasta contro la peggiore.

-- quante squadre giocano in ogni turno (es. 19 -> {19,10,6,4,2})
create or replace function public.tournament_round_counts(p_n int) returns int[]
language plpgsql immutable as $$
declare a int := p_n; out int[] := '{}';
begin
  if p_n < 2 then return '{}'; end if;
  while a > 1 loop
    out := out || a;
    a := ceil(a / 2.0)::int;
    if a > 1 and a % 2 = 1 then a := a + 1; end if;
  end loop;
  return out;
end $$;

-- accoppia una lista ordinata per testa di serie: se dispari il primo passa, poi primo contro ultimo
create or replace function public.tournament_pair(p_ids uuid[]) returns table(slot int, a uuid, b uuid)
language plpgsql immutable as $$
declare n int := coalesce(array_length(p_ids, 1), 0); l uuid[]; i int; s int := 0;
begin
  if n = 0 then return; end if;
  if n % 2 = 1 then slot := 0; a := p_ids[1]; b := null; return next; s := 1; l := p_ids[2:n]; else l := p_ids; end if;
  for i in 1..(coalesce(array_length(l, 1), 0) / 2) loop
    slot := s; a := l[i]; b := l[array_length(l, 1) + 1 - i]; return next; s := s + 1;
  end loop;
end $$;

create or replace function public.tournament_start(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments; n int; ids uuid[]; k int; a uuid; r record; seed_of jsonb;
begin
  select * into t from tournaments where id = p_id for update;
  perform tournament_auto_entries(p_id);
  select count(*) into n from tournament_entries where tournament_id = p_id;
  if n < 2 then
    for a in select org_id from tournament_entries where tournament_id = p_id loop
      perform contest_pay(a, t.entry_fee, format('Rimborso: torneo annullato (%s)', t.title)); end loop;
    execute 'up'||'date tournaments set status = ''annullato'', pot = 0 where id = $1' using p_id;
    return;
  end if;
  select array_agg(e.org_id order by o.reputation desc nulls last, e.joined_at) into ids
    from tournament_entries e join organizations o on o.id = e.org_id where e.tournament_id = p_id;
  for k in 1..n loop
    execute 'up'||'date tournament_entries set seed = $1 where tournament_id = $2 and org_id = $3' using k, p_id, ids[k];
  end loop;
  for r in select * from tournament_pair(ids) loop
    insert into tournament_matches (tournament_id, round, slot, org_a, org_b, seed_a, seed_b, starts_at, ends_at, done, winner_org, score_a, score_b)
    values (p_id, 1, r.slot, r.a, r.b, array_position(ids, r.a), case when r.b is null then null else array_position(ids, r.b) end,
            t.starts_at, t.starts_at + interval '1 hour', r.b is null, case when r.b is null then r.a end,
            case when r.b is null then 0 end, case when r.b is null then 0 end);
  end loop;
  execute 'up'||'date tournaments set status = ''in_corso'', size = $1, rounds = $2, current_round = 1 where id = $3'
    using n, coalesce(array_length(tournament_round_counts(n), 1), 1), p_id;
end $$;

create or replace function public.tournament_tick() returns int
language plpgsql security definer set search_path = public as $$
declare t record; m record; sa int; sb int; w uuid; n int := 0; v_open int; v_end timestamptz;
  wa uuid; wb uuid; pool bigint; semi uuid; adv uuid[]; lucky uuid; r record; nr int;
begin
  perform tournament_schedule();
  for t in select id from tournaments where status = 'iscrizioni' and starts_at <= now() loop
    perform tournament_start(t.id); n := n + 1;
  end loop;
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
  for t in select * from tournaments where status = 'in_corso' loop
    select count(*) filter (where not done), max(ends_at) into v_open, v_end from tournament_matches where tournament_id = t.id and round = t.current_round;
    if v_open > 0 then continue; end if;
    -- chi passa, in ordine di testa di serie
    select array_agg(mt.winner_org order by e.seed) into adv
      from tournament_matches mt join tournament_entries e on e.tournament_id = mt.tournament_id and e.org_id = mt.winner_org
     where mt.tournament_id = t.id and mt.round = t.current_round;
    if coalesce(array_length(adv, 1), 0) <= 1 then
      -- finale giocata: premi
      select winner_org, case when winner_org = org_a then org_b else org_a end into wa, wb
        from tournament_matches where tournament_id = t.id and round = t.current_round and org_b is not null limit 1;
      pool := t.base_prize + t.pot;
      perform contest_pay(wa, round(pool * 0.60)::bigint, format('🏆 Vittoria: %s', t.title));
      perform contest_pay(wb, round(pool * 0.25)::bigint, format('🥈 Finale: %s', t.title));
      if t.current_round >= 2 then
        for semi in select case when winner_org = org_a then org_b else org_a end from tournament_matches
                     where tournament_id = t.id and round = t.current_round - 1 and org_b is not null
                       and (case when winner_org = org_a then org_b else org_a end) is distinct from wb
                       and (case when winner_org = org_a then org_b else org_a end) is distinct from wa loop
          perform contest_pay(semi, round(pool * 0.075)::bigint, format('🥉 Semifinale: %s', t.title));
        end loop;
      end if;
      execute 'up'||'date tournaments set status = ''finito'', winner_org = $1, runner_org = $2, rounds = current_round where id = $3' using wa, wb, t.id;
      continue;
    end if;
    -- vincitori dispari: ripescato il miglior perdente del turno (più servizi, poi testa di serie migliore)
    if array_length(adv, 1) % 2 = 1 then
      select l.org_id into lucky from (
        select case when mt.winner_org = mt.org_a then mt.org_b else mt.org_a end org_id,
               case when mt.winner_org = mt.org_a then mt.score_b else mt.score_a end sc,
               case when mt.winner_org = mt.org_a then mt.seed_b else mt.seed_a end sd
          from tournament_matches mt where mt.tournament_id = t.id and mt.round = t.current_round and mt.org_b is not null) l
       order by l.sc desc nulls last, l.sd limit 1;
      if lucky is not null then
        execute 'up'||'date tournament_entries set out_round = null where tournament_id = $1 and org_id = $2' using t.id, lucky;
        select array_agg(x order by e.seed) into adv from unnest(adv || lucky) x join tournament_entries e on e.tournament_id = t.id and e.org_id = x;
      end if;
    end if;
    nr := t.current_round + 1;
    for r in select * from tournament_pair(adv) loop
      insert into tournament_matches (tournament_id, round, slot, org_a, org_b, seed_a, seed_b, starts_at, ends_at, done, winner_org, score_a, score_b)
      values (t.id, nr, r.slot, r.a, r.b,
              (select seed from tournament_entries where tournament_id = t.id and org_id = r.a),
              (select seed from tournament_entries where tournament_id = t.id and org_id = r.b),
              v_end, v_end + interval '1 hour', r.b is null, case when r.b is null then r.a end,
              case when r.b is null then 0 end, case when r.b is null then 0 end)
      on conflict do nothing;
    end loop;
    execute 'up'||'date tournaments set current_round = $1, rounds = greatest(rounds, $1) where id = $2' using nr, t.id;
  end loop;
  perform challenge_tick();
  return n;
end $$;

-- anteprima e mio stato con le stesse regole
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('public.tournament_detail(bigint)'::regprocedure), E'\r\n', E'\n');
  new_src := replace(src, $a$      n := coalesce(array_length(ids, 1), 0);
      rr := ceil(log(2, greatest(2, n)::numeric))::int; sz := power(2, rr)::int;
      for k in 0..(sz / 2 - 1) loop
        a := ids[k + 1]; b := case when sz - k <= n then ids[sz - k] end;
        acc := acc || jsonb_build_object('round', 1, 'slot', k, 'starts_at', t.starts_at, 'ends_at', t.starts_at + interval '1 hour', 'done', false,
          'winner', null, 'seed_a', k + 1, 'seed_b', case when b is null then null else sz - k end,$a$,
$a$      n := coalesce(array_length(ids, 1), 0);
      rr := coalesce(array_length(tournament_round_counts(n), 1), 1); sz := n;
      for k, a, b in select p.slot, p.a, p.b from tournament_pair(ids) p loop
        acc := acc || jsonb_build_object('round', 1, 'slot', k, 'starts_at', t.starts_at, 'ends_at', t.starts_at + interval '1 hour', 'done', false,
          'winner', null, 'seed_a', array_position(ids, a), 'seed_b', array_position(ids, b),$a$);
  new_src := replace(new_src, $a$      for j in 2..rr loop
        for k in 0..(sz / power(2, j)::int - 1) loop$a$,
$a$      for j in 2..rr loop
        for k in 0..((tournament_round_counts(n))[j] / 2 - 1) loop$a$);
  if position('tournament_pair(ids)' in new_src) = 0 or position('tournament_round_counts(n))[j]' in new_src) = 0 then raise exception 'ESITO patch anteprima non applicata'; end if;
  execute new_src;
end $$;

create or replace function public.my_tournament_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := my_org_id(); t tournaments; m tournament_matches; ids uuid[]; n int; opp uuid; o organizations; p record;
  sa int; sb int; out_r int; myk int;
begin
  if me is null then return null; end if;
  select * into t from tournaments where status = 'in_corso' order by starts_at limit 1;
  if t.id is null then select * into t from tournaments where status = 'iscrizioni' order by starts_at limit 1; end if;
  if t.id is null then return null; end if;

  if t.status = 'iscrizioni' then
    ids := tournament_active_ids();
    n := coalesce(array_length(ids, 1), 0);
    myk := array_position(ids, me);
    if myk is null then
      return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', false, 'players', n,
        'rounds', coalesce(array_length(tournament_round_counts(n), 1), 1), 'prize', t.base_prize + t.pot);
    end if;
    select * into p from tournament_pair(ids) x where x.a = me or x.b = me;
    opp := case when p.a = me then p.b else p.a end;
    select * into o from organizations where id = opp;
    return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', true,
      'players', n, 'rounds', coalesce(array_length(tournament_round_counts(n), 1), 1), 'my_seed', myk,
      'opp_seed', case when opp is null then null else array_position(ids, opp) end,
      'opp', case when opp is null then null else jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url) end,
      'prize', t.base_prize + t.pot);
  end if;

  select out_round into out_r from tournament_entries where tournament_id = t.id and org_id = me;
  if not found then
    return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', false,
      'current_round', t.current_round, 'rounds', t.rounds);
  end if;
  select * into m from tournament_matches where tournament_id = t.id and (org_a = me or org_b = me) order by round desc limit 1;
  opp := case when m.org_a = me then m.org_b else m.org_a end;
  select * into o from organizations where id = opp;
  sa := case when m.done or m.starts_at > now() then case when m.org_a = me then m.score_a else m.score_b end else contest_score(me, t.kind, m.starts_at, m.ends_at) end;
  sb := case when opp is null then null when m.done or m.starts_at > now() then case when m.org_a = me then m.score_b else m.score_a end else contest_score(opp, t.kind, m.starts_at, m.ends_at) end;
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', true,
    'rounds', t.rounds, 'current_round', t.current_round, 'out_round', out_r, 'prize', t.base_prize + t.pot,
    'match', jsonb_build_object('round', m.round, 'starts_at', m.starts_at, 'ends_at', m.ends_at, 'done', m.done, 'won', m.winner_org = me,
       'my_score', sa, 'opp_score', sb,
       'opp', case when opp is null then null else jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url) end));
end $$;

do $$
declare d jsonb; t bigint; byes int;
begin
  raise notice 'ESITO turni con 19 squadre: %, con 64: %, con 5: %', tournament_round_counts(19), tournament_round_counts(64), tournament_round_counts(5);
  select id into t from tournaments where status = 'iscrizioni' order by starts_at limit 1;
  if t is not null then
    d := tournament_detail(t);
    select count(*) into byes from jsonb_array_elements(d->'matches') x where (x->>'round')::int = 1 and x->'b' = 'null'::jsonb;
    raise notice 'ESITO anteprima torneo %: % turni, % incontri al primo turno, passaggi gratis %', t, d->>'rounds',
      (select count(*) from jsonb_array_elements(d->'matches') x where (x->>'round')::int = 1), byes;
  end if;
end $$;
