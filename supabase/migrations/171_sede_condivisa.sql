-- 171: la "sede in collaborazione" è condivisa col gemello: può usare i mezzi fermi lì.
alter table bases add column if not exists collab_org uuid references organizations(id);

-- un mezzo è usabile anche dall'org con cui la sua sede è in collaborazione (se gemellati)
create or replace function public.can_use_vehicle(p_vehicle uuid, p_org uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select coalesce(vehicle_borrower(p_vehicle), (select org_id from vehicles where id = p_vehicle)) = p_org
      or exists (
        select 1 from vehicles v join bases b on b.id = v.base_id
        where v.id = p_vehicle and b.collab_org = p_org and are_twinned(v.org_id, p_org)
      )
$fn$;

-- "sede in collaborazione": rinomina col nome del gemellaggio E la condivide col gemello
create or replace function public.twin_rename_base(p_base uuid, p_twin uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_twin) then raise exception 'NOT_TWINNED'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_FOUND'; end if;
  update bases set collab_org = p_twin,
                   name = '🤝 ' || (select name from organizations where id = v_org) || ' × ' || (select name from organizations where id = p_twin)
   where id = p_base;
end $fn$;

-- smetti di condividere la sede
create or replace function public.twin_unshare_base(p_base uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_FOUND'; end if;
  update bases set collab_org = null where id = p_base;
end $fn$;
grant execute on function public.twin_unshare_base(uuid) to authenticated;

-- una sede donata smette di essere condivisa dal vecchio proprietario
create or replace function public.gift_base(p_base uuid, p_to uuid) returns void
 language plpgsql security definer set search_path to 'public' as $fn$
declare v_org uuid := my_org_id(); b bases;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not are_twinned(v_org, p_to) then raise exception 'NOT_TWINNED'; end if;
  select * into b from bases where id = p_base and org_id = v_org for update;
  if not found then raise exception 'BASE_NOT_FOUND'; end if;
  if b.is_headquarters then raise exception 'HQ_NOT_GIFTABLE'; end if;
  if exists (select 1 from vehicles where base_id = p_base and status = 'in_servizio') then raise exception 'BASE_BUSY'; end if;
  update vehicles set org_id = p_to where base_id = p_base;
  update bases set org_id = p_to, is_headquarters = false, collab_org = null where id = p_base;
end $fn$;

-- my_fleet include anche i mezzi fermi in una sede condivisa con me
do $$
declare d text;
begin
  d := pg_get_viewdef('public.my_fleet'::regclass, true);
  d := regexp_replace(d, ';\s*$', '');
  if position('b.collab_org = my_org_id()' in d) = 0 then
    d := replace(d, 'vehicle_borrower(id) = my_org_id()',
      'vehicle_borrower(id) = my_org_id() OR (EXISTS ( SELECT 1 FROM bases b WHERE b.id = v.base_id AND b.collab_org = my_org_id() AND are_twinned(v.org_id, my_org_id())))');
    if position('b.collab_org = my_org_id()' in d) = 0 then raise exception 'my_fleet: innesto collab non trovato'; end if;
    execute 'create or replace view public.my_fleet as ' || d;
  end if;
end $$;
