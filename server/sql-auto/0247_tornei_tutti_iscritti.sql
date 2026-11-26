-- 0247: ai tornei partecipano tutte le associazioni attive (servizi conclusi negli ultimi 2 giorni), senza iscrizione e senza quota.
alter table public.tournaments alter column entry_fee set default 0;

-- restituisco le quote già pagate per i tornei non ancora partiti
do $$
declare t record; e record;
begin
  for t in select * from tournaments where status = 'iscrizioni' and entry_fee > 0 loop
    for e in select org_id from tournament_entries where tournament_id = t.id loop
      perform contest_pay(e.org_id, t.entry_fee, format('Rimborso iscrizione (ora i tornei sono gratis): %s', t.title));
    end loop;
    execute 'up'||'date tournaments set entry_fee = 0, pot = 0 where id = $1' using t.id;
  end loop;
end $$;

create or replace function public.tournament_auto_entries(p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare n int; room int;
begin
  select count(*) into n from tournament_entries where tournament_id = p_id;
  room := greatest(0, 64 - n);
  insert into tournament_entries (tournament_id, org_id)
  select p_id, o.id from organizations o
   where not exists (select 1 from tournament_entries e where e.tournament_id = p_id and e.org_id = o.id)
     and exists (select 1 from mission_assignments a where a.org_id = o.id and a.status = 'conclusa' and a.completed_at > now() - interval '2 days')
   order by o.reputation desc nulls last
   limit room
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('public.tournament_start(bigint)'::regprocedure), E'\r\n', E'\n');
  if position('tournament_auto_entries' in src) > 0 then raise notice 'ESITO già fatto'; return; end if;
  new_src := replace(src, E'  select count(*) into n from tournament_entries where tournament_id = p_id;\n  if n < 2 then',
                          E'  perform tournament_auto_entries(p_id);\n  select count(*) into n from tournament_entries where tournament_id = p_id;\n  if n < 2 then');
  if new_src = src then raise exception 'ESITO patch tournament_start non applicata'; end if;
  execute new_src;
end $$;

-- per i tornei in arrivo mostro quante associazioni parteciperanno
create or replace function public.tournament_expected() returns int
language sql stable security definer set search_path = public as $$
  select least(64, count(*))::int from organizations o
   where exists (select 1 from mission_assignments a where a.org_id = o.id and a.status = 'conclusa' and a.completed_at > now() - interval '2 days')
$$;
grant execute on function public.tournament_expected() to authenticated;

do $$ begin raise notice 'ESITO tornei automatici per tutti: parteciperebbero % associazioni', public.tournament_expected(); end $$;
