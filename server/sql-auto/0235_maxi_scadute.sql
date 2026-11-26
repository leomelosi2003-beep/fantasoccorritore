-- maxi finite da più di 30 minuti ma rimaste "aperte" con mezzi ancora in viaggio (es. aereo C-130 per Lamezia di ieri):
-- i mezzi chiudono il servizio adesso e la maxi si chiude. Lo stesso controllo gira poi ogni volta con i feriti delle maxi.
create or replace function public.close_stale_maxi() returns int
 language plpgsql security definer set search_path to 'public' as $$
declare m record; n int := 0;
begin
  for m in select id from missions where category = 'grande_evento' and event_id is null
              and status in ('aperta', 'completa', 'in_corso') and event_ends_at < now() - interval '30 minutes' loop
    execute 'up'||'date mission_assignments set completes_at = now() where mission_id = $1 and status in (''in_viaggio'', ''sul_posto'') and completes_at > now()' using m.id;
    if not exists (select 1 from mission_assignments where mission_id = m.id and status in ('in_viaggio', 'sul_posto')) then
      execute 'up'||'date missions set status = ''scaduta'' where id = $1' using m.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.close_stale_maxi() from public, anon, authenticated;
do $$
declare src text; new_src text; n int;
begin
  n := close_stale_maxi();
  src := pg_get_functiondef('maxi_patients_tick'::regproc);
  if position('close_stale_maxi' in src) = 0 then
    new_src := replace(src, E'  return n;\nend', E'  perform close_stale_maxi();\n  return n;\nend');
    if new_src = src then raise exception 'ESITO patch non applicata'; end if;
    execute new_src;
  end if;
  raise notice 'ESITO maxi vecchie chiuse: %', n;
end $$;
