-- 0253: se le squadre sono dispari, chi passa il primo turno senza giocare è estratto A SORTE (non più la testa di serie n.1).
-- Il sorteggio è fisso per ogni torneo (stesso risultato nell'anteprima e alla partenza).
create or replace function public.tournament_pair(p_ids uuid[], p_salt text) returns table(slot int, a uuid, b uuid)
language plpgsql immutable as $$
declare n int := coalesce(array_length(p_ids, 1), 0); lucky uuid; l uuid[]; i int; s int := 0;
begin
  if n = 0 then return; end if;
  if n % 2 = 1 then
    select x into lucky from unnest(p_ids) x order by md5(p_salt || x::text) limit 1;
    slot := 0; a := lucky; b := null; return next; s := 1;
    select array_agg(x order by ord) into l from unnest(p_ids) with ordinality u(x, ord) where x <> lucky;
  else l := p_ids; end if;
  for i in 1..(coalesce(array_length(l, 1), 0) / 2) loop
    slot := s; a := l[i]; b := l[array_length(l, 1) + 1 - i]; return next; s := s + 1;
  end loop;
end $$;

do $$
declare src text; new_src text; fn text;
begin
  foreach fn in array array['public.tournament_start(bigint)', 'public.tournament_detail(bigint)', 'public.my_tournament_status()'] loop
    src := replace(pg_get_functiondef(fn::regprocedure), E'\r\n', E'\n');
    if position('tournament_pair(ids, ' in src) > 0 then continue; end if;
    new_src := replace(src, 'tournament_pair(ids)', case when fn like '%start%' then 'tournament_pair(ids, p_id::text)' else 'tournament_pair(ids, t.id::text)' end);
    if new_src = src then raise exception 'ESITO patch % non applicata', fn; end if;
    execute new_src;
  end loop;
end $$;

do $$
declare d jsonb; t bigint; who text;
begin
  select id into t from tournaments where status = 'iscrizioni' order by starts_at limit 1;
  if t is not null then
    d := tournament_detail(t);
    select x->'a'->>'name' into who from jsonb_array_elements(d->'matches') x where (x->>'round')::int = 1 and x->'b' = 'null'::jsonb;
    raise notice 'ESITO sorteggio fatto per il torneo %: passa da sola la testa di serie n. %', t,
      (select x->>'seed_a' from jsonb_array_elements(d->'matches') x where (x->>'round')::int = 1 and x->'b' = 'null'::jsonb);
  end if;
end $$;
