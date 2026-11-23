-- misura (tutto annullato alla fine): quanto ci mette lo smistamento automatico per ogni associazione
do $$
declare o record; t0 timestamptz; ms int; tot int := 0; nf int;
begin
  for o in select id, name from organizations where auto_enabled and cardinality(auto_codes) > 0 and cardinality(auto_base_ids) > 0 and auto_paid_until > now() loop
    t0 := clock_timestamp();
    perform auto_dispatch_org(o.id);
    ms := extract(epoch from clock_timestamp() - t0) * 1000; tot := tot + ms;
    select count(*) into nf from vehicles where org_id = o.id and status = 'disponibile' and base_id = any((select auto_base_ids from organizations where id = o.id));
    raise notice 'ESITO % ms  mezzi_liberi_in_auto=%  %', ms, nf, left(md5(o.id::text), 6);
  end loop;
  raise notice 'ESITO totale % ms', tot;
  raise exception 'ESITO prova annullata';
end $$;
