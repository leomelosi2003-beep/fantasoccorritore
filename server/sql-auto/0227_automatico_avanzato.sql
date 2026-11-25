-- anche l'automatico considera "autista avanzato" chi era soccorritore avanzato ed è diventato autista col corso
do $$
declare src text; new_src text; m text;
begin
  src := replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n');
  for m in select distinct x[1] from regexp_matches(src, '([a-z_0-9]+\.avanzato)', 'g') x loop
    raise notice 'ESITO trovato %', m;
  end loop;
  new_src := regexp_replace(src, '([a-z_0-9]+)\.avanzato', $a$(\1.avanzato or \1.role in ('soccorritore_avanzato', 'caposervizio'))$a$, 'g');
  if new_src = src then raise exception 'ESITO niente da cambiare'; end if;
  execute new_src;
  raise notice 'ESITO automatico aggiornato';
end $$;
