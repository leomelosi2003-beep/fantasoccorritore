-- nuova classifica premiata: 🔴 Codici rossi del mese (servizi in codice rosso portati a termine)
create or replace function public.reds_board(p_month date default date_trunc('month', now() at time zone 'Europe/Rome')::date)
returns table(org_id uuid, reds int)
 language sql stable security definer set search_path to 'public' as $$
  select a.org_id, count(*)::int
    from mission_assignments a join missions m on m.id = a.mission_id
   where a.status = 'conclusa' and m.code = 'rosso'
     and a.completes_at >= (p_month::timestamp at time zone 'Europe/Rome')
     and a.completes_at < ((p_month + interval '1 month')::timestamp at time zone 'Europe/Rome')
   group by a.org_id
$$;
grant execute on function public.reds_board(date) to authenticated;

-- premi: stessa scala di Rivelazione e Reputazione (da 10 milioni)
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('pay_season_prizes'::regproc), E'\r\n', E'\n');
  if position('''rossi''' in src) = 0 then
    new_src := replace(src, E'  for r in select * from season_prizes where season = p_season loop',
      E'  for r in\n    select ''rossi'' cat, row_number() over (order by reds desc) rk, org_id, reds::numeric sc from reds_board(p_season) where reds > 0 order by reds desc limit 10\n  loop\n    insert into season_prizes values (p_season, r.cat, r.rk, r.org_id, r.sc, season_prize(r.cat, r.rk::int)); n := n + 1; end loop;\n  for r in select * from season_prizes where season = p_season loop');
    new_src := replace(new_src, $a$'{"punti":"Stagione","reputazione":"Reputazione","rivelazione":"Rivelazione"}'$a$, $a$'{"punti":"Stagione","reputazione":"Reputazione","rivelazione":"Rivelazione","rossi":"Codici rossi"}'$a$);
    if new_src = src or position('reds_board' in new_src) = 0 then raise exception 'ESITO patch premi non applicata'; end if;
    execute new_src;
  end if;
  -- fotografie: aggiungo i rossi
  src := replace(pg_get_functiondef('take_rank_snapshot'::regproc), E'\r\n', E'\n');
  if position('reds' in src) = 0 then
    new_src := replace(src, $a$'per_vehicle', b.per_vehicle))$a$, $a$'per_vehicle', b.per_vehicle, 'reds', rd.reds))$a$);
    new_src := replace(new_src, 'left join season_board() b on b.org_id = l.org_id;', E'left join season_board() b on b.org_id = l.org_id\n    left join reds_board() rd on rd.org_id = l.org_id;');
    if new_src = src or position('rd.reds' in new_src) = 0 then raise exception 'ESITO patch fotografie non applicata'; end if;
    execute new_src;
  end if;
  raise notice 'ESITO classifica codici rossi pronta: % associazioni con almeno un rosso', (select count(*) from reds_board());
end $$;
