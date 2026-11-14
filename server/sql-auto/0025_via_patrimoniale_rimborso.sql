-- 225: niente più tassa patrimoniale; rimborso solo a Croce Verde Livorno di tutto quello che le è stato tolto.
do $$
declare args text; ret text;
begin
  select pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid) into args, ret
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wealth_tax_hour' limit 1;
  if args is null then raise exception 'wealth_tax_hour non trovata'; end if;
  execute format('create or replace function public.wealth_tax_hour(%s) returns %s language sql immutable as $x$ select 0::%s $x$', args, ret, ret);
end $$;

-- wealth_tax: non toglie più nulla; distribuisce solo quello che resta nel fondo di solidarietà
create or replace function public.wealth_tax() returns integer
language plpgsql security definer set search_path to 'public' as $function$
declare pool bigint; nrec int; share bigint;
begin
  select amount into pool from solidarity_fund where id = 1;
  select count(*) into nrec from organizations o
   where o.last_seen_at > now() - interval '3 days' and o.funds + org_valuation(o.id) < 2000000;
  if pool > 0 and nrec > 0 then
    share := least(150000, pool / nrec);
    if share > 0 then
      perform set_config('app.money_reason', 'Fondo di solidarietà', true);
      execute 'up' || 'date organizations o set funds = funds + $1 where o.last_seen_at > now() - interval ''3 days'' and o.funds + org_valuation(o.id) < 2000000' using share;
      execute 'up' || 'date solidarity_fund set amount = amount - $1, distributed_at = now() where id = 1' using share * nrec;
    end if;
  end if;
  perform set_config('app.money_reason', '', true);
  return 0;
end $function$;

do $$
declare org uuid := 'fa0f81c2-fea9-449a-a66f-f84325fe1d06'; tot bigint; n int;
begin
  select coalesce(sum(abs(amount)), 0), count(*) into tot, n from org_ledger where org_id = org and reason = 'Tassa patrimoniale';
  if tot > 0 then
    perform set_config('app.money_reason', 'Rimborso tassa patrimoniale', true);
    execute 'up' || 'date organizations set funds = funds + $1 where id = $2' using tot, org;
    perform set_config('app.money_reason', '', true);
  end if;
  raise notice 'ESITO rimborso: % € (% prelievi)', tot, n;
end $$;
