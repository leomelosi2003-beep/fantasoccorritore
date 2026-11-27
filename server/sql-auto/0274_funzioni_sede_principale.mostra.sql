\pset pager off
\pset format unaligned
select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and (pg_get_functiondef(p.oid) like '%IS_HQ%' or p.proname in ('settle_base_auctions','resolve_base_auctions','close_base_auctions'))
   and p.prokind = 'f';
select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'public.bases'::regclass and not tgisinternal;
