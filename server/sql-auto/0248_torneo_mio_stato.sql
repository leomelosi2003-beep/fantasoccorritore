-- 0248: stato del MIO torneo: conto alla rovescia, avversario previsto prima dell'inizio, incontro in corso con punteggio
create or replace function public.my_tournament_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := my_org_id(); t tournaments; m tournament_matches; ids uuid[]; n int; v_size int; k int; opp uuid; o organizations;
  sa int; sb int; out_r int;
begin
  if me is null then return null; end if;
  -- torneo in corso dove sono ancora in gara, altrimenti il prossimo
  select * into t from tournaments where status = 'in_corso' order by starts_at limit 1;
  if t.id is null then select * into t from tournaments where status = 'iscrizioni' order by starts_at limit 1; end if;
  if t.id is null then return null; end if;

  if t.status = 'iscrizioni' then
    select array_agg(id order by reputation desc nulls last) into ids from (
      select o2.id, o2.reputation from organizations o2
       where exists (select 1 from mission_assignments a where a.org_id = o2.id and a.status = 'conclusa' and a.completed_at > now() - interval '2 days')
       order by o2.reputation desc nulls last limit 64) s;
    n := coalesce(array_length(ids, 1), 0);
    k := array_position(ids, me);
    if k is null then
      return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', false, 'players', n);
    end if;
    v_size := power(2, ceil(log(2, greatest(2, n)::numeric)))::int;
    if v_size + 1 - k <= n then opp := ids[v_size + 1 - k]; end if;
    select * into o from organizations where id = opp;
    return jsonb_build_object('id', t.id, 'kind', t.kind, 'title', t.title, 'status', t.status, 'starts_at', t.starts_at, 'in', true,
      'players', n, 'rounds', ceil(log(2, greatest(2, n)::numeric))::int, 'my_seed', k, 'opp_seed', case when opp is null then null else v_size + 1 - k end,
      'opp', case when opp is null then null else jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type::text, 'logo_url', o.logo_url) end,
      'prize', t.base_prize + t.pot);
  end if;

  -- in corso
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
grant execute on function public.my_tournament_status() to authenticated;
do $$ begin raise notice 'ESITO stato torneo pronto'; end $$;
