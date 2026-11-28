-- 0279: ripeto 0278 (era andata in timeout aspettando il blocco sulla tabella dei mezzi, non aveva cambiato niente)
set local lock_timeout = '60s';
-- 0278: uso dei mezzi sistemato.
--  * Nuovo uso "🔁 Entrambi": l'ambulanza fa sia emergenze sia ordinari (dialisi/dimissioni).
--  * Prima l'automatica ignorava l'uso scelto: mandava i mezzi "solo ordinari" sulle emergenze e le ambulanze normali sugli ordinari,
--    la partenza veniva rifiutata e il mezzo restava fermo. Ora l'automatica rispetta l'uso di ogni mezzo.
--  * Tasto sulla sede: cambia l'uso di tutti i mezzi della sede in un colpo (solo emergenze / solo ordinari / entrambi).
alter table public.vehicles add column if not exists use_both boolean not null default false;

-- il mezzo può fare questo servizio secondo l'uso scelto?
create or replace function public.vehicle_use_ok(p_vehicle uuid, p_category text, p_transport text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'ordinario' and p_transport is distinct from 'trasferimento'
      then coalesce(vm.ordinaria, false) or v.converted_ordinaria or v.use_both
    when p_category = 'ordinario' then true            -- trasferimenti: regole dei passi lunghi, invariate
    else not v.converted_ordinaria end
  from vehicles v join vehicle_models vm on vm.id = v.model_id where v.id = p_vehicle
$$;

create or replace function public.set_vehicle_use(p_vehicle uuid, p_use text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); v vehicles; m vehicle_models;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into v from vehicles where id = p_vehicle and org_id = v_org for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  select * into m from vehicle_models where id = v.model_id;
  if m.ordinaria or m.boat or m.automedica or m.aib or coalesce(m.moto, false) then raise exception 'USE_FIXED'; end if;
  if v.km_retired and p_use <> 'ordinari' then raise exception 'KM_LIMIT'; end if;
  if p_use = 'ordinari' then
    execute 'up'||'date vehicles set converted_ordinaria = true, long_emergency = false, use_both = false where id = $1' using v.id;
  elsif p_use = 'emergenze' then
    execute 'up'||'date vehicles set converted_ordinaria = false, long_emergency = $2, use_both = false where id = $1' using v.id, coalesce(m.transfer_only, false);
  elsif p_use = 'entrambi' then
    execute 'up'||'date vehicles set converted_ordinaria = false, long_emergency = $2, use_both = true where id = $1' using v.id, coalesce(m.transfer_only, false);
  elsif p_use = 'trasferimenti' and m.transfer_only then
    execute 'up'||'date vehicles set converted_ordinaria = false, long_emergency = false, use_both = false where id = $1' using v.id;
  else raise exception 'BAD_USE'; end if;
end $$;

-- tutta la sede in un colpo (salta i mezzi con uso fisso e quelli oltre il limite di km)
create or replace function public.set_base_use(p_base uuid, p_use text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_org uuid := my_org_id(); r record; n int := 0;
begin
  if p_use not in ('emergenze', 'ordinari', 'entrambi') then raise exception 'BAD_USE'; end if;
  if not exists (select 1 from bases where id = p_base and org_id = v_org) then raise exception 'BASE_NOT_FOUND'; end if;
  for r in select v.id from vehicles v join vehicle_models m on m.id = v.model_id
            where v.base_id = p_base and v.org_id = v_org
              and not (coalesce(m.ordinaria, false) or coalesce(m.boat, false) or coalesce(m.automedica, false) or coalesce(m.aib, false) or coalesce(m.moto, false))
              and (not v.km_retired or p_use = 'ordinari') loop
    perform set_vehicle_use(r.id, p_use); n := n + 1;
  end loop;
  return n;
end $$;

-- per le pagine: uso di ogni mio mezzo e riassunto per sede
create or replace function public.my_vehicle_uses() returns table(id uuid, use_both boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.use_both from vehicles v where v.org_id = my_org_id()
$$;
create or replace function public.my_base_uses() returns table(base_id uuid, emergenze int, ordinari int, entrambi int)
language sql stable security definer set search_path = public as $$
  select v.base_id, count(*) filter (where not v.converted_ordinaria and not v.use_both)::int,
         count(*) filter (where v.converted_ordinaria)::int, count(*) filter (where v.use_both)::int
    from vehicles v join vehicle_models m on m.id = v.model_id
   where v.org_id = my_org_id()
     and not (coalesce(m.ordinaria, false) or coalesce(m.boat, false) or coalesce(m.automedica, false) or coalesce(m.aib, false) or coalesce(m.moto, false))
   group by v.base_id
$$;
grant execute on function public.set_vehicle_use(uuid, text), public.set_base_use(uuid, text), public.my_vehicle_uses(), public.my_base_uses() to authenticated;

-- partenza a mano: "entrambi" può fare gli ordinari
do $$
declare src text; new_src text; oid_ oid;
begin
  select p.oid into oid_ from pg_proc p where p.proname = 'claim_mission_as' order by p.oid desc limit 1;
  src := replace(pg_get_functiondef(oid_), E'\r\n', E'\n');
  if position('veh.use_both' in src) = 0 then
    new_src := replace(src, 'or veh.converted_ordinaria) then raise exception ''DIMISSIONE_NEEDS_ORDINARIA''',
                            'or veh.converted_ordinaria or veh.use_both) then raise exception ''DIMISSIONE_NEEDS_ORDINARIA''');
    if new_src = src then raise exception 'ESITO patch partenza non applicata'; end if;
    execute new_src;
  end if;
end $$;

-- automatica: rispetta l'uso del mezzo (prova su tutte le associazioni, se qualcosa va storto rimetto com'era)
do $$
declare src text; new_src text; oid_ oid; o record; ok boolean := true; err text;
  a1 text := $a$and (not v.transfer_only or mm.transport = 'trasferimento') and (not v.transport_only or mm.transport = 'trasferimento' or mm.code = 'nessuno')$a$;
  a2 text := $a$and (not f.transfer_only or mm.transport = 'trasferimento') and (not f.transport_only or mm.transport = 'trasferimento' or mm.code = 'nessuno')$a$;
begin
  select p.oid into oid_ from pg_proc p where p.proname = 'auto_dispatch_org' order by p.oid desc limit 1;
  src := replace(pg_get_functiondef(oid_), E'\r\n', E'\n');
  if position('vehicle_use_ok' in src) > 0 then raise notice 'ESITO automatica già fatta'; return; end if;
  if position(a1 in src) = 0 or position(a2 in src) = 0 then raise exception 'ESITO testo automatica non trovato'; end if;
  new_src := replace(src, a1, a1 || ' and vehicle_use_ok(v.id, mm.category::text, mm.transport::text)');
  new_src := replace(new_src, a2, a2 || ' and vehicle_use_ok(f.id, mm.category::text, mm.transport::text)');
  execute new_src;
  for o in select id from organizations where auto_enabled loop
    begin perform auto_dispatch_org(o.id);
    exception when others then ok := false; err := sqlerrm; exit; end;
  end loop;
  if not ok then execute src; raise notice 'ESITO ERRORE automatica, rimessa com''era: %', err;
  else raise notice 'ESITO automatica rispetta l''uso dei mezzi: prova su tutte ok'; end if;
end $$;
