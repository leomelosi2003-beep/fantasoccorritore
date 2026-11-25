-- automatico: l'autista che era soccorritore avanzato vale come autista avanzato (con il nome di colonna giusto)
do $$
declare src text; new_src text; ok int := 0; ko int := 0; e text; o record;
  x constant text := $a$(vo.avanzato or vo.role in ('soccorritore_avanzato', 'caposervizio'))$a$;
begin
  src := replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n');
  new_src := replace(src, 'select ci.id, vo.avanzato from card_inventory ci', 'select ci.id, ' || x || ' as avanzato from card_inventory ci');
  new_src := replace(new_src, 'order by (vo.avanzato and need_adv > 0) desc', 'order by (' || x || ' and need_adv > 0) desc');
  new_src := replace(new_src, $a$= 'autista') desc, vo.avanzato desc,$a$, $a$= 'autista') desc, $a$ || x || ' desc,');
  if new_src = src then raise exception 'ESITO patch non applicata'; end if;
  execute new_src;
  for o in select id from organizations where auto_enabled and cardinality(auto_base_ids) > 0 and auto_paid_until > now() loop
    begin perform auto_dispatch_org(o.id); ok := ok + 1; exception when others then ko := ko + 1; e := sqlerrm; end;
  end loop;
  if ko > 0 then execute src; raise notice 'ESITO ripristinato originale (errore: %)', e;
  else raise notice 'ESITO automatico aggiornato, % prove ok', ok; end if;
end $$;
