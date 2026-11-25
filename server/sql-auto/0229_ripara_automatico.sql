-- URGENTE: rimetto lo smistamento automatico com'era prima della 0227, poi lo aggiorno solo dove serve (con il nome della colonna)
do $$
declare src text; new_src text; ok int := 0; ko int := 0; e text; o record;
begin
  src := replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n');
  new_src := regexp_replace(src, $a$\(([a-z_0-9]+)\.avanzato or [a-z_0-9]+\.role in \('soccorritore_avanzato', 'caposervizio'\)\)$a$, '\1.avanzato', 'g');
  if new_src = src then raise exception 'ESITO niente da ripristinare'; end if;
  -- il dato "avanzato" della carta viene dal volontario: chi era avanzato ed è diventato autista resta avanzato
  new_src := replace(new_src, 'vo.avanzato', $a$(vo.avanzato or vo.role in ('soccorritore_avanzato', 'caposervizio'))$a$);
  execute new_src;
  -- se la seconda modifica rompe qualcosa, torno alla versione originale pura
  for o in select id from organizations where auto_enabled and cardinality(auto_base_ids) > 0 and auto_paid_until > now() limit 6 loop
    begin perform auto_dispatch_org(o.id); ok := ok + 1; exception when others then ko := ko + 1; e := sqlerrm; end;
  end loop;
  if ko > 0 then
    execute regexp_replace(src, $a$\(([a-z_0-9]+)\.avanzato or [a-z_0-9]+\.role in \('soccorritore_avanzato', 'caposervizio'\)\)$a$, '\1.avanzato', 'g');
    raise notice 'ESITO ripristinato originale (la modifica dava: %)', e;
  else
    raise notice 'ESITO automatico riparato e aggiornato (% prove ok)', ok;
  end if;
end $$;
