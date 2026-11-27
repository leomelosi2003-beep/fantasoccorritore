-- 0264: 1) regalo a tutte le associazioni: un F-Ducalis (Fiat Ducato) con kit completo + un equipaggio intero
--          (1 autista, 1 soccorritore avanzato, 1 soccorritore base) nella sede principale.
--       2) modalità automatica sempre attiva: si scelgono solo i turni delle sedi. Niente più interruttore e niente modalità aggressiva.
--          Si paga come prima per i turni scelti; se mancano i soldi quell'ora resta ferma e riparte da sola appena ci sono.
-- Nessun dato cancellato.

do $$
declare o record; hq uuid; vid uuid; r text; vol uuid; n_mezzi int := 0; n_vol int := 0; owned uuid[];
begin
  for o in select org.id from organizations org where exists (select 1 from bases b where b.org_id = org.id) loop
    begin
      select id into hq from bases where org_id = o.id order by is_headquarters desc, built_at limit 1;
      vid := prize_vehicle(o.id, 'F-Ducalis', 'Ducato regalo');
      if vid is not null then n_mezzi := n_mezzi + 1; end if;
      select coalesce(array_agg(volunteer_id), '{}') into owned from card_inventory where org_id = o.id and state <> 'scaduta';
      foreach r in array array['autista', 'soccorritore_avanzato', 'soccorritore_base'] loop
        select id into vol from volunteers where role = r::volunteer_role and rarity = 'comune' and is_pack_eligible and id <> all(owned)
         order by random() limit 1;
        if vol is not null then
          insert into card_inventory (org_id, volunteer_id, base_id) values (o.id, vol, hq);
          owned := owned || vol; n_vol := n_vol + 1;
        end if;
      end loop;
    exception when others then
      raise notice 'ESITO regalo non riuscito per una associazione: %', sqlerrm;
    end;
  end loop;
  raise notice 'ESITO regalati % Ducato e % volontari', n_mezzi, n_vol;
end $$;

-- automatica sempre attiva, niente aggressiva, tutti i tipi di servizio, nessuna ambulanza tenuta da parte
do $$
begin
  execute 'up'||'date organizations set auto_enabled = true, auto_steal_red = false, auto_reserve = 0,
     auto_codes = array[''rosso'',''giallo'',''verde'',''ordinari'',''trasferimenti'']';
end $$;

do $$
declare src text; new_src text;
begin
  -- il pagamento ogni ora vale per tutti: chi non ha soldi resta fermo quell'ora e riparte da solo
  src := replace(pg_get_functiondef('public.charge_auto_mode()'::regprocedure), E'\r\n', E'\n');
  if position('auto_enabled = true' in src) = 0 then
    new_src := regexp_replace(src, 'where\s+auto_enabled\s+and\s+\(auto_paid_until', 'where (auto_paid_until');
    new_src := replace(new_src, 'if not found then update organizations set auto_enabled = false where id = o.id; end if;',
      'if not found then update organizations set auto_enabled = false where id = o.id and auto_enabled;
    else update organizations set auto_enabled = true where id = o.id and not auto_enabled; end if;');
    if position('auto_enabled = true' in new_src) = 0 or new_src ~ 'where\s+auto_enabled\s+and\s+\(auto_paid_until' then
      raise exception 'ESITO patch pagamento automatica non applicata';
    end if;
    execute new_src;
  end if;
  -- il sito non può più spegnerla né attivare l'aggressiva
  src := replace(pg_get_functiondef('public.set_auto_mode(boolean, text[], integer, boolean)'::regprocedure), E'\r\n', E'\n');
  if position('auto_enabled = true,' in src) = 0 then
    new_src := replace(src, 'set auto_enabled = p_enabled,', 'set auto_enabled = true,');
    new_src := replace(new_src, 'auto_steal_red = coalesce(p_steal_red, false)', 'auto_steal_red = false');
    if position('auto_enabled = true,' in new_src) = 0 or position('auto_steal_red = false' in new_src) = 0 then
      raise exception 'ESITO patch set_auto_mode non applicata';
    end if;
    execute new_src;
  end if;
  raise notice 'ESITO automatica sempre attiva: % associazioni, aggressive %', (select count(*) from organizations where auto_enabled),
    (select count(*) from organizations where auto_steal_red);
end $$;
