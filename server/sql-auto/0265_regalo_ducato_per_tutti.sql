-- 0265: il regalo di 0264 era riuscito solo a una associazione (la sigla del mezzo deve essere unica in tutto il gioco).
-- Ora ogni Ducato ha una sigla sua ("Ducato" + numero). Chi l'ha già avuto non lo riceve due volte.
do $$
declare o record; hq uuid; vid uuid; r text; vol uuid; n_mezzi int := 0; n_vol int := 0; owned uuid[]; k int := 0; cs text;
begin
  for o in select org.id from organizations org
            where exists (select 1 from bases b where b.org_id = org.id)
              and not exists (select 1 from vehicles v where v.org_id = org.id and v.call_sign like 'Ducato regalo%')
            order by org.created_at loop
    begin
      select id into hq from bases where org_id = o.id order by is_headquarters desc, built_at limit 1;
      loop
        k := k + 1; cs := 'Ducato regalo ' || k;
        exit when not exists (select 1 from vehicles where call_sign = cs);
      end loop;
      vid := prize_vehicle(o.id, 'F-Ducalis', cs);
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
      raise notice 'ESITO regalo non riuscito: %', sqlerrm;
    end;
  end loop;
  raise notice 'ESITO regalati altri % Ducato e % volontari; Ducato regalo in tutto: %', n_mezzi, n_vol,
    (select count(*) from vehicles where call_sign like 'Ducato regalo%');
end $$;
