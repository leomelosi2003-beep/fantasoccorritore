-- 231: sedi condivise in gemellaggio: anche il gemello può ampliarle, migliorarle e metterci i suoi mezzi.
-- Le entrate delle migliorie di una sede condivisa si dividono a metà; se la condivisione finisce i mezzi del gemello tornano alla sua sede principale.
create or replace function public.can_manage_base(p_base uuid, p_org uuid) returns boolean
language sql stable security definer set search_path = public as $f$
  select exists (select 1 from bases b where b.id = p_base and (b.org_id = p_org or (b.collab_org = p_org and are_twinned(b.org_id, p_org))))
$f$;

-- riporta alla sede principale i mezzi "ospiti" (non del proprietario) parcheggiati in una sede
create or replace function public._twin_evict(p_base uuid) returns int
language plpgsql security definer set search_path = public as $f$
declare n int;
begin
  execute 'up' || 'date vehicles v set base_id = (select h.id from bases h where h.org_id = v.org_id and h.is_headquarters limit 1)
     where v.base_id = $1 and v.org_id <> (select org_id from bases where id = $1)
       and exists (select 1 from bases h where h.org_id = v.org_id and h.is_headquarters)' using p_base;
  get diagnostics n = row_count;
  return n;
end $f$;

do $$
declare src text; n text;
begin
  src := pg_get_functiondef('public.upgrade_base'::regproc);
  n := replace(src, 'from bases where id = p_base and org_id = v_org for update', 'from bases where id = p_base and can_manage_base(id, v_org) for update');
  if n = src then raise exception 'upgrade_base'; end if; execute n;

  src := pg_get_functiondef('public.buy_base_perk'::regproc);
  n := replace(src, 'from bases where id = p_base and org_id = v_org for update', 'from bases where id = p_base and can_manage_base(id, v_org) for update');
  if n = src then raise exception 'buy_base_perk'; end if; execute n;

  src := pg_get_functiondef('public.set_base_color'::regproc);
  n := replace(src, 'from bases where id = p_base and org_id = v_org)', 'from bases where id = p_base and can_manage_base(id, v_org))');
  if n = src then raise exception 'set_base_color'; end if; execute n;

  src := pg_get_functiondef('public.move_vehicle'::regproc);
  n := replace(src, 'from bases where id = p_base and org_id = v_org;', 'from bases where id = p_base and can_manage_base(id, v_org);');
  if n = src then raise exception 'move_vehicle'; end if; execute n;

  src := replace(pg_get_functiondef('public.buy_vehicle'::regproc), E'\r\n', E'\n');
  n := replace(src, 'from bases where id = p_base_id and org_id = v_org;', 'from bases where id = p_base_id and can_manage_base(id, v_org);');
  if n = src then raise exception 'buy_vehicle'; end if; execute n;

  -- condivisione chiusa: i mezzi del gemello tornano a casa
  src := pg_get_functiondef('public.twin_unshare_base'::regproc);
  n := replace(src, '  update bases set collab_org = null where id = p_base;', '  perform _twin_evict(p_base);
  update bases set collab_org = null where id = p_base;');
  if n = src then raise exception 'twin_unshare_base'; end if; execute n;

  src := pg_get_functiondef('public.end_twinning'::regproc);
  n := replace(src, '  delete from twinnings where id = p_id;', '  perform _twin_evict(b.id) from bases b
   where (b.org_id = t.org_a and b.collab_org = t.org_b) or (b.org_id = t.org_b and b.collab_org = t.org_a);
  execute ''up'' || ''date bases set collab_org = null where (org_id = $1 and collab_org = $2) or (org_id = $2 and collab_org = $1)'' using t.org_a, t.org_b;
  delete from twinnings where id = p_id;');
  if n = src then raise exception 'end_twinning'; end if; execute n;
end $$;

-- nella sede condivisa ognuno può usare i mezzi fermi dell'altro
create or replace function public.can_use_vehicle(p_vehicle uuid, p_org uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select coalesce(vehicle_borrower(p_vehicle), (select org_id from vehicles where id = p_vehicle)) = p_org
      or exists (
        select 1 from vehicles v join bases b on b.id = v.base_id
        where v.id = p_vehicle and b.collab_org is not null
          and ((b.collab_org = p_org and v.org_id = b.org_id) or (b.org_id = p_org and v.org_id = b.collab_org))
          and are_twinned(b.org_id, b.collab_org)
      )
$function$;

-- entrate delle migliorie: nelle sedi condivise metà al gemello
create or replace function public.pay_base_perks()
returns integer language plpgsql security definer set search_path = public as $f$
declare r record; n int := 0;
begin
  perform set_config('app.money_reason', 'Migliorie sedi: risparmi ed entrate', true);
  for r in
    with inc as (
      select b.id, b.org_id, case when b.collab_org is not null and are_twinned(b.org_id, b.collab_org) then b.collab_org end twin, base_income_h(b.id) amt
        from bases b
       where exists (select 1 from base_perks p where p.base_id = b.id and p.level > 0) or b.color is not null)
    select org_id oid, sum(case when twin is null then amt else amt / 2 end) amt from inc group by org_id
    union all
    select twin, sum(amt - amt / 2) from inc where twin is not null group by twin
  loop
    if r.amt > 0 then execute 'up' || 'date organizations set funds = funds + $1 where id = $2' using r.amt, r.oid; n := n + 1; end if;
  end loop;
  perform set_config('app.money_reason', '', true);
  return n;
end $f$;
revoke execute on function public.pay_base_perks() from public, anon, authenticated;
notify pgrst, 'reload schema';
select 'ESITO gestione sedi gemellate ok';
