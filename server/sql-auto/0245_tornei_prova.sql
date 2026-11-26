-- 0245: prova del tabellone (tutto annullato alla fine, non resta niente)
do $$
declare t bigint; o uuid[]; n int; r record;
begin
  select array_agg(id) into o from (select id from organizations order by reputation desc nulls last limit 5) s;
  insert into tournaments (kind, title, starts_at) values ('rossi', 'Prova', now() - interval '5 seconds') returning id into t;
  insert into tournament_entries (tournament_id, org_id) select t, unnest(o);
  perform tournament_start(t);
  select count(*) into n from tournament_matches where tournament_id = t;
  raise notice 'ESITO prova: % iscritti, % incontri al primo turno, tabellone da %', array_length(o,1), n, (select size from tournaments where id = t);
  for r in select slot, seed_a, seed_b, done from tournament_matches where tournament_id = t order by slot loop
    raise notice 'ESITO incontro %: testa % contro % (gia finito: %)', r.slot, r.seed_a, coalesce(r.seed_b::text, 'nessuno'), r.done;
  end loop;
  -- simulo la fine del primo turno
  execute 'up'||'date tournament_matches set starts_at = now() - interval ''2 hours'', ends_at = now() - interval ''1 hour'' where tournament_id = $1' using t;
  perform tournament_tick();
  raise notice 'ESITO dopo il primo turno: turno %, incontri secondo turno %', (select current_round from tournaments where id = t),
    (select count(*) from tournament_matches where tournament_id = t and round = 2);
  raise notice 'ESITO punteggio di prova: %', contest_score(o[1], 'rossi', now() - interval '1 hour', now());
  raise notice 'ESITO tornei programmati: %', (select string_agg(title || ' ' || to_char(starts_at at time zone 'Europe/Rome', 'DD/MM HH24:MI'), ' | ') from tournaments where title <> 'Prova');
  raise exception 'annullo la prova';
end $$;
