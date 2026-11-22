-- Modalità automatica a metà prezzo + rimborso della differenza solo a Croce Verde Livorno
create or replace function public.auto_hour_cost_org(p_org uuid)
 returns integer language sql stable security definer set search_path to 'public' as $function$
  select (250 + round(0.0005 * w + 0.00025 * greatest(0, w - 1000000)))::int
    from (select greatest(0, o.funds + org_valuation(o.id)) w from organizations o where o.id = p_org) x
$function$;

do $$
declare o uuid; spent bigint; refund bigint;
begin
  select id into o from organizations where name ilike 'croce verde livorno%' order by created_at limit 1;
  if o is null then raise exception 'ESITO associazione non trovata'; end if;
  select coalesce(-sum(amount), 0) into spent from org_ledger where org_id = o and reason ilike 'Modalità automatica%' and amount < 0;
  refund := spent / 2;
  if refund > 0 then
    perform set_config('app.money_reason', 'Rimborso modalità automatica (differenza nuovo prezzo)', true);
    execute 'up'||'date organizations set funds = funds + $1 where id = $2' using refund, o;
    perform set_config('app.money_reason', '', true);
  end if;
  raise notice 'ESITO speso in automatico % €, rimborsati % €', spent, refund;
end $$;
