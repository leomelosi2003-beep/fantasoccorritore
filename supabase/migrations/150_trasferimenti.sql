-- Trasferimenti molto più redditizi e un po' più veloci, trasferimenti urgenti (anche con medico)
-- e ambulanze "solo dimissioni e trasferimenti" per la modalità automatica.
--
-- Premio: 4.000 € + 130 €/km di strada (prima 1.500 + 30): da ~26 €/min a oltre 100 €/min.
--   x1,2 fuori regione, x1,15 protetto, x1,5 urgente giallo / x1,8 urgente rosso, x1,3 con medico.
-- Velocità: 100 km/h in strada (prima 85), 115 km/h se urgente; carico/scarico 3 minuti (prima 5).
-- Partenza: l'ospedale più vicino a una sede (entro 20 km), così ogni città con una sede ha trasferimenti.
-- Fino a min(15, 4 + sedi/6) trasferimenti aperti, al massimo 2 nuovi ogni 5 minuti.
-- Urgenti (~35%): giallo, rosso 1 su 3; il medico serve sempre nei rossi, nella metà dei gialli e nel 15% dei normali.
-- Categoria 'ordinario' (il trigger normalize_emergency_roles imporrebbe 2 avanzati sulle emergenze 118 e toglierebbe il medico).

alter table public.vehicles add column if not exists auto_transport_only boolean not null default false;

create or replace function public.set_vehicle_transport_only(p_vehicle uuid, p_on boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  execute 'up' || 'date vehicles set auto_transport_only = $1 where id = $2 and org_id = $3'
    using coalesce(p_on, false), p_vehicle, my_org_id();
  if not found then raise exception 'NOT_YOURS'; end if;
end $$;
revoke all on function public.set_vehicle_transport_only(uuid, boolean) from public, anon;
grant execute on function public.set_vehicle_transport_only(uuid, boolean) to authenticated;

do $$
declare src text;
begin
  ---------------------------------------------------------------- claim_mission_as
  -- alcune funzioni sono salvate con a capo Windows (CR+LF): li normalizzo prima di cercare i pezzi da cambiare
  src := replace(pg_get_functiondef('public.claim_mission_as(uuid, uuid, uuid, uuid[])'::regprocedure), E'\r\n', E'\n');
  if position('MISSING_ROLE:medico' in src) = 0 then
    if (length(src) - length(replace(src, '85 * sf', ''))) / length('85 * sf') <> 2 then raise exception 'claim: 85 * sf non trovato 2 volte'; end if;
    src := replace(src, '85 * sf', '(case when m.code in (''giallo'', ''rosso'') then 115 else 100 end) * sf');
    if position('t2 := t1 + interval ''5 minutes'';
    t3 := t2 + make_interval(secs => leg_road_minutes' in src) = 0 then raise exception 'claim: carico trasferimento non trovato'; end if;
    src := replace(src, 't2 := t1 + interval ''5 minutes'';
    t3 := t2 + make_interval(secs => leg_road_minutes', 't2 := t1 + interval ''3 minutes'';
    t3 := t2 + make_interval(secs => leg_road_minutes');
    if position('t4 := t3 + interval ''5 minutes'';
    t5 := t4 + make_interval(secs => leg_road_minutes' in src) = 0 then raise exception 'claim: scarico trasferimento non trovato'; end if;
    src := replace(src, 't4 := t3 + interval ''5 minutes'';
    t5 := t4 + make_interval(secs => leg_road_minutes', 't4 := t3 + interval ''3 minutes'';
    t5 := t4 + make_interval(secs => leg_road_minutes');
    if position('  end loop;

  end if;
  update missions' in src) = 0 then raise exception 'claim: punto controllo ruoli non trovato'; end if;
    src := replace(src, '  end loop;

  end if;
  update missions', '  end loop;
  -- se il servizio chiede il medico serve proprio un medico (non basta un caposervizio)
  if coalesce((m.required_roles->>''medico'')::int, 0) > (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id
       where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''medico'') then
    raise exception ''MISSING_ROLE:medico''; end if;

  end if;
  update missions');
    execute src;
  end if;

  ---------------------------------------------------------------- auto_dispatch_org
  src := replace(pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure), E'\r\n', E'\n');
  if position('transport_only' in src) = 0 then
    src := replace(src, 'transfer_only boolean, electric boolean', 'transfer_only boolean, transport_only boolean, electric boolean');
    src := replace(src, 'certification, equipment, transfer_only, electric, range_left, sf)', 'certification, equipment, transfer_only, transport_only, electric, range_left, sf)');
    src := replace(src, 'vv.certification, vv.equipment, vm.transfer_only, vm.electric,', 'vv.certification, vv.equipment, vm.transfer_only, vv.auto_transport_only, vm.electric,');
    src := replace(src, 'and not v.transfer_only then', 'and not v.transfer_only and not v.transport_only then');
    src := replace(src, 'and not f.used and f.id <> v.id and not f.transfer_only', 'and not f.used and f.id <> v.id and not f.transfer_only and not f.transport_only');
    src := replace(src, 'mm.code::text = any(o.auto_codes) and mm.code in (''rosso'', ''giallo'')',
                        'mm.code::text = any(o.auto_codes) and mm.code in (''rosso'', ''giallo'') and mm.transport is distinct from ''trasferimento''');
    src := replace(src, 'and (not v.transfer_only or mm.transport = ''trasferimento'')',
                        'and (not v.transfer_only or mm.transport = ''trasferimento'') and (not v.transport_only or mm.transport = ''trasferimento'' or mm.code = ''nessuno'')');
    src := replace(src, 'and (not f.transfer_only or mm.transport = ''trasferimento'')',
                        'and (not f.transfer_only or mm.transport = ''trasferimento'') and (not f.transport_only or mm.transport = ''trasferimento'' or mm.code = ''nessuno'')');
    src := replace(src, 'order by (coalesce(ci.role_override, vo.role) = ''medico''), current_energy(ci.id) desc',
                        'order by ((coalesce(ci.role_override, vo.role) = ''medico'') = (coalesce((m.required_roles->>''medico'')::int, 0) > 0)) desc, current_energy(ci.id) desc');
    execute src;
  end if;
  src := pg_get_functiondef('public.auto_dispatch_org(uuid)'::regprocedure);
  if (length(src) - length(replace(src, 'transport_only', ''))) / length('transport_only') <> 7
     or position('mm.transport is distinct from ''trasferimento''' in src) = 0
     or position('required_roles->>''medico''' in src) = 0 then
    raise exception 'patch auto_dispatch_org fallita (transport_only x%)', (length(src) - length(replace(src, 'transport_only', ''))) / length('transport_only');
  end if;

  ---------------------------------------------------------------- auto_medical: il cambio delle automediche non usa queste ambulanze
  src := replace(pg_get_functiondef('public.auto_medical(uuid)'::regprocedure), E'\r\n', E'\n');
  if position('auto_transport_only' in src) = 0 then
    if (length(src) - length(replace(src, 'and not vm.automedica and not vm.transfer_only and', ''))) / length('and not vm.automedica and not vm.transfer_only and') <> 2 then
      raise exception 'auto_medical: filtro ambulanze non trovato 2 volte'; end if;
    src := replace(src, 'and not vm.automedica and not vm.transfer_only and', 'and not vm.automedica and not vm.transfer_only and not vv.auto_transport_only and');
    execute src;
  end if;
end $$;

---------------------------------------------------------------- nuovi trasferimenti
create or replace function public.generate_transfers()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $$
declare
  o hospitals; d hospitals; v_base uuid; nb int; cap int; n int := 0;
  road_km numeric; fuori boolean; urg boolean; rosso boolean; med boolean; protetto boolean; want_same boolean; rew int; roles jsonb;
begin
  select count(*) into nb from bases;
  if nb = 0 then return 0; end if;
  cap := least(15, 4 + nb / 6);

  for k in 1 .. 2 loop
    exit when (select count(*) from missions where transport = 'trasferimento' and status = 'aperta' and expires_at > now()) >= cap;

    -- associazione a caso, poi una sua sede: si parte dall'ospedale più vicino (entro 20 km)
    select b.id into v_base from bases b
     where b.org_id = (select org_id from bases group by org_id order by random() limit 1)
     order by random() limit 1;
    o := null;
    select h.* into o from hospitals h, bases b
     where b.id = v_base and st_dwithin(h.location, b.location, 20000)
     order by st_distance(h.location, b.location) limit 1;
    continue when o.id is null;

    want_same := random() < 0.6;
    d := null;
    select h.* into d from hospitals h
     where h.transfer_dest and h.id <> o.id and not st_dwithin(h.location, o.location, 10000)
     order by ((h.region = o.region) = want_same) desc, random() limit 1;
    continue when d.id is null;

    road_km := st_distance(o.location, d.location) / 1000.0 * 1.3;
    fuori := d.region is distinct from o.region;
    urg := random() < 0.35;
    rosso := urg and random() < 0.33;
    med := rosso or (urg and random() < 0.5) or (not urg and random() < 0.15);
    protetto := not urg and not med and random() < 0.4;
    rew := (round((4000 + 130 * road_km)
                  * case when fuori then 1.2 else 1 end
                  * case when protetto then 1.15 else 1 end
                  * case when rosso then 1.8 when urg then 1.5 else 1 end
                  * case when med then 1.3 else 1 end / 100) * 100)::int;
    roles := case when med then '{"autista":1,"soccorritore_avanzato":1,"medico":1}'::jsonb
                  when urg then '{"autista":1,"soccorritore_avanzato":2}'::jsonb
                  when protetto then '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}'::jsonb
                  else '{"autista":1,"soccorritore_base":1}'::jsonb end;

    insert into missions (category, code, title, description, location, slots_total, required_roles, min_certification,
                          duration_minutes, base_fatigue, reward_funds, reward_reputation, requires, transport,
                          hospital_from_id, hospital_to_id, expires_at, source)
    values ('ordinario',
            (case when rosso then 'rosso' when urg then 'giallo' else 'nessuno' end)::mission_code,
            case when urg then '🚨 Trasferimento urgente ' else 'Trasferimento ' end
              || case when fuori then 'fuori regione ' else '' end || '→ ' || d.name,
            o.name || ' → ' || d.name || ' · ' || round(road_km) || ' km · ' || coalesce(d.specialty, '')
              || case when med then ' · con medico' when protetto then ' · protetto' else '' end,
            o.location, 1, roles,
            (case when urg or med then 'avanzata_rianimazione' else 'trasporto' end)::certification,
            round(2 * road_km / case when urg then 115 else 100 end * 60 + 20)::int,
            case when urg then 10 else 4 end, rew,
            case when urg then 5 when fuori then 4 else 2 end,
            case when urg or med or protetto then '{defib}'::text[] else '{}'::text[] end,
            'trasferimento', o.id, d.id,
            now() + case when urg then interval '10 minutes' else interval '15 minutes' end, 'scheduler');
    n := n + 1;
  end loop;
  return n;
end $$;
