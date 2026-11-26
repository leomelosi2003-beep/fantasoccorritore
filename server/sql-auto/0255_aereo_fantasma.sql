-- 0255: due mezzi di BOB.EMERGENCY (maxi "Fuga di gas" del 25/11) avevano il servizio chiuso ma la rotta di ritorno in aereo
-- finiva il 27-28/11, quindi il C-130 restava sulla mappa. Tolgo la rotta di ritorno (il mezzo è già rientrato) e aggiungo
-- un controllo fisso: un servizio concluso non può avere una rotta che finisce più di 3 ore dopo la fine del servizio.
do $$
declare n int;
begin
  execute 'up'||'date mission_assignments set route = null
     where status in (''conclusa'', ''annullata'') and route is not null
       and fs_route_end(route, completes_at) > completes_at + interval ''3 hours''
       and fs_route_end(route, completes_at) > now()';
  get diagnostics n = row_count;
  raise notice 'ESITO rotte fantasma tolte: %', n;
end $$;

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
  -- rientri impossibili (rotta che finisce ore dopo il servizio concluso): il mezzo si considera già in sede
  execute 'up'||'date mission_assignments set route = null
     where status in (''conclusa'', ''annullata'') and route is not null
       and completes_at > now() - interval ''2 days''
       and fs_route_end(route, completes_at) > completes_at + interval ''3 hours''
       and fs_route_end(route, completes_at) > now()';
  return n;
end $$;
revoke execute on function public.close_stale_maxi() from public, anon, authenticated;
do $$ begin raise notice 'ESITO aerei ancora in volo dopo la pulizia: %', (select count(*) from mission_assignments where route::text like '%✈%' and fs_route_end(route, completes_at) > now() and status in ('conclusa','annullata')); end $$;
