-- smistamento automatico ogni 30 s ma ogni volta su un terzo delle associazioni (ognuna servita ogni 90 s): niente più blocchi da 10-20 s
create or replace function public.auto_dispatch()
 returns integer language sql security definer set search_path to 'public' as $function$
  select coalesce(sum(auto_dispatch_org(o.id)), 0)::int
    from organizations o
   where o.auto_enabled and cardinality(o.auto_codes) > 0 and cardinality(o.auto_base_ids) > 0 and o.auto_paid_until > now()
     and mod(abs(hashtext(o.id::text)), 3) = mod((extract(epoch from now()) / 30)::bigint, 3)
$function$;
do $$
declare src text; new_src text;
begin
  src := pg_get_functiondef('game_tick'::regproc);
  new_src := replace(src, '(''dispatch'',60,3)', '(''dispatch'',30,3)');
  if new_src = src then raise exception 'ESITO cadenza non trovata'; end if;
  execute new_src;
  raise notice 'ESITO smistamento a turni attivo';
end $$;
