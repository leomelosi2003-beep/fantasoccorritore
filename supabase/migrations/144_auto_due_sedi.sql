-- Modalità automatica solo sulle sedi scelte (al massimo 2), in organizations.auto_base_ids.
-- Vale per ambulanze, automediche, barche, officina automatica e ricarica automatica dei volontari.
-- All'inizio ogni associazione ha in automatico la sua sede principale, così chi l'aveva accesa non si ferma.
-- Se l'elenco è vuoto la modalità automatica non manda nessun mezzo.

alter table public.organizations add column if not exists auto_base_ids uuid[] not null default '{}';

update public.organizations o
   set auto_base_ids = array[b.id]
  from public.bases b
 where b.org_id = o.id and b.is_headquarters and cardinality(o.auto_base_ids) = 0;

update public.organizations o
   set auto_base_ids = array[(select b.id from public.bases b where b.org_id = o.id order by b.built_at limit 1)]
 where cardinality(o.auto_base_ids) = 0 and exists (select 1 from public.bases b where b.org_id = o.id);

-- scelta delle sedi dalla pagina "Modalità automatica"
create or replace function public.set_auto_bases(p_bases uuid[])
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_org uuid := my_org_id(); v_req uuid[]; v_ok uuid[];
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  v_req := array(select distinct x from unnest(coalesce(p_bases, '{}'::uuid[])) x where x is not null);
  if cardinality(v_req) > 2 then raise exception 'TOO_MANY_BASES'; end if;
  v_ok := array(select b.id from bases b where b.org_id = v_org and b.id = any(v_req));
  if cardinality(v_ok) <> cardinality(v_req) then raise exception 'BASE_NOT_YOURS'; end if;
  update organizations set auto_base_ids = v_ok where id = v_org;
  return v_ok;
end $$;
revoke all on function public.set_auto_bases(uuid[]) from public, anon;
grant execute on function public.set_auto_bases(uuid[]) to authenticated;

-- se una sede passa ad un'altra associazione (aste, acquisizioni) la tolgo dalla scelta del vecchio proprietario
create or replace function public.bases_auto_cleanup()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  execute 'up' || 'date organizations set auto_base_ids = array_remove(auto_base_ids, $1) where id = $2 and $1 = any(auto_base_ids)'
    using old.id, old.org_id;
  return null;
end $$;
drop trigger if exists bases_auto_cleanup on public.bases;
create trigger bases_auto_cleanup after update of org_id or delete on public.bases
  for each row execute function public.bases_auto_cleanup();

-- patch: auto_dispatch_org e auto_medical usano solo i mezzi delle sedi scelte
do $$
declare src text; n int;
begin
  src := pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure);
  if position('auto_base_ids' in src) = 0 then
    n := (length(src) - length(replace(src, 'and vehicle_borrower(vv.id) is null', ''))) / length('and vehicle_borrower(vv.id) is null');
    if n <> 3 then raise exception 'patch auto_dispatch_org: attese 3 occorrenze, trovate %', n; end if;
    src := replace(src, 'and vehicle_borrower(vv.id) is null', 'and vehicle_borrower(vv.id) is null and vv.base_id = any(o.auto_base_ids)');
    src := replace(src, 'where auto_enabled and cardinality(auto_codes) > 0 and',
                        'where auto_enabled and cardinality(auto_codes) > 0 and cardinality(auto_base_ids) > 0 and');
    execute src;
  end if;
  src := pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure);
  if (length(src) - length(replace(src, 'auto_base_ids', ''))) / length('auto_base_ids') <> 4 then
    raise exception 'patch auto_dispatch_org fallita';
  end if;

  src := pg_get_functiondef('public.auto_medical(uuid)'::regprocedure);
  if position('auto_base_ids' in src) = 0 then
    n := (length(src) - length(replace(src, 'vehicle_borrower(vv.id) is null', ''))) / length('vehicle_borrower(vv.id) is null');
    if n <> 4 then raise exception 'patch auto_medical: attese 4 occorrenze, trovate %', n; end if;
    src := replace(src, 'vehicle_borrower(vv.id) is null', 'vehicle_borrower(vv.id) is null and vv.base_id = any(o.auto_base_ids)');
    src := replace(src, 'where auto_enabled and auto_paid_until > now()',
                        'where auto_enabled and auto_paid_until > now() and cardinality(auto_base_ids) > 0');
    execute src;
  end if;
  src := pg_get_functiondef('public.auto_medical(uuid)'::regprocedure);
  if (length(src) - length(replace(src, 'auto_base_ids', ''))) / length('auto_base_ids') <> 5 then
    raise exception 'patch auto_medical fallita';
  end if;
end $$;
