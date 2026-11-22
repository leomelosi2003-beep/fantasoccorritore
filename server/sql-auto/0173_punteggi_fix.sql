-- le righe della tabella condividono il separatore: non "mangiarlo" a fine riga, altrimenti si salta una partita su due
do $$
declare src text; new_src text;
begin
  src := pg_get_functiondef('scores_tick'::regproc);
  new_src := replace(src, '\|([^|]+)\|([^|]+)\|'', ''g'')', '\|([^|]+)\|([^|]+)(?=\|)'', ''g'')');
  if new_src = src then raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  raise notice 'ESITO lettura righe corretta';
end $$;
