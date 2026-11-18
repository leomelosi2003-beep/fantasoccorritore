-- Antincendio: come le ambulanze, il mezzo torna libero appena lascia il fuoco per rientrare in sede
-- (si può riattivare mentre rientra: riparte dal punto della strada in cui si trova).
do $$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'v_free := coalesce((v_route->-1->>''t'')::timestamptz, m.event_ends_at);',
                    'v_free := coalesce((v_route->-2->>''t'')::timestamptz, m.event_ends_at);   -- libero appena inizia il rientro');
  if n = src then raise exception 'claim: riga AIB non trovata'; end if;
  execute n;
end $$;
-- mezzi antincendio già in servizio: libero all'inizio del rientro
do $$
declare k int;
begin
  execute 'up'||'date mission_assignments ma set completes_at = (ma.route->-2->>''t'')::timestamptz
     from missions m where m.id = ma.mission_id and m.venue = ''AIB'' and ma.status not in (''conclusa'',''annullata'')
       and jsonb_array_length(ma.route) >= 3 and ma.completes_at > (ma.route->-2->>''t'')::timestamptz';
  get diagnostics k = row_count;
  raise notice 'ESITO mezzi AIB in servizio aggiornati: %', k;
end $$;
select 'ESITO aib', position('libero appena inizia il rientro' in pg_get_functiondef('public.claim_mission_as'::regproc)) > 0;
