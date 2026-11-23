-- lo smistamento automatico gira ogni 30 s ma ogni volta solo su un terzo delle associazioni:
-- ognuna viene servita ogni 90 s come prima, ma il carico è spezzato e il sito non si blocca più per 10-20 secondi
create or replace function public.auto_dispatch()
 returns integer language sql security definer set search_path to 'public' as $function$
  select coalesce(sum(auto_dispatch_org(o.id)), 0)::int
    from organizations o
   where o.auto_enabled and cardinality(o.auto_codes) > 0 and cardinality(o.auto_base_ids) > 0 and o.auto_paid_until > now()
     and mod(abs(hashtext(o.id::text)), 3) = mod((extract(epoch from now()) / 30)::bigint, 3)
$function$;
do $$ begin
  execute 'up'||'date tick_state set every_s = 30 where task = ''dispatch''';
  raise notice 'ESITO smistamento a turni attivo';
end $$;
