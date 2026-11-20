-- claim: con l'aereo la fine della sosta è l'ultimo "Sul posto", non il penultimo punto (che è lo sbarco del volo di ritorno)
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position('fs_stay_end' in src) > 0 then return; end if;
  n := replace(src, $$(v_route->-2->>'t')::timestamptz$$,
               $$(case when v_route::text like '%C-130%' then fs_stay_end(v_route) else (v_route->-2->>'t')::timestamptz end)$$);
  if n = src then raise exception 'patch claim non applicata'; end if;
  execute n;
end $d$;
select 'ESITO claim', (length(pg_get_functiondef('public.claim_mission_as'::regproc)) - length(replace(pg_get_functiondef('public.claim_mission_as'::regproc), 'fs_stay_end', ''))) / 11;
