-- 20 milioni a Croce Rosa Livorno (richiesta dell'admin)
do $$
declare n int; o uuid;
begin
  select count(*), min(id::text)::uuid into n, o from organizations where name ilike '%croce%rosa%livorno%';
  if n <> 1 then raise exception 'ESITO associazioni trovate: %', n; end if;
  perform set_config('app.money_reason', 'Ricarica dall''amministratore', true);
  execute 'up'||'date organizations set funds = funds + 20000000 where id = $1' using o;
  perform set_config('app.money_reason', '', true);
  raise notice 'ESITO 20.000.000 € caricati';
end $$;
