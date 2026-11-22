-- Premi alleanza: la cifra va intera a OGNI membro (non divisa)
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('close_alliance_season'::regproc), E'\r\n', E'\n');
  new_src := replace(src, 'each := prize / greatest(n, 1);', 'each := prize;   -- a testa');
  if new_src = src then raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  raise notice 'ESITO premi alleanza a testa';
end $$;
