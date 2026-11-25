-- prova che lo smistamento automatico funzioni ancora (annullata alla fine)
do $$
declare o record; ok int := 0; ko int := 0; e text;
begin
  for o in select id from organizations where auto_enabled and cardinality(auto_base_ids) > 0 and auto_paid_until > now() loop
    begin perform auto_dispatch_org(o.id); ok := ok + 1;
    exception when others then ko := ko + 1; e := sqlerrm; end;
  end loop;
  raise notice 'ESITO automatico: % ok, % errori %', ok, ko, coalesce(e, '');
  raise exception 'ESITO prova annullata';
end $$;
