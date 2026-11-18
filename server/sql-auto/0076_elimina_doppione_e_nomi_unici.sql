-- Elimina l'alleanza doppione "soccorso livornese" (non quella di Croce Verde Livorno) e vieta i nomi uguali ad alleanze esistenti.
-- Le associazioni dentro restano intatte: escono solo dall'alleanza; i soldi del fondo vengono restituiti divisi tra loro.
do $$
declare d alliances; n int; share bigint; mine uuid := 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
begin
  select count(*) into n from alliances where lower(regexp_replace(name, '[^[:alnum:]]', '', 'g')) = 'soccorsolivornese' and founder_org <> mine;
  if n <> 1 then raise exception 'doppione: trovate % alleanze, mi fermo', n; end if;
  select * into d from alliances where lower(regexp_replace(name, '[^[:alnum:]]', '', 'g')) = 'soccorsolivornese' and founder_org <> mine;
  if not exists (select 1 from alliances where founder_org = mine and lower(regexp_replace(name, '[^[:alnum:]]', '', 'g')) = 'soccorsolivornese') then
    raise exception 'la tua Soccorso Livornese non c''è, mi fermo';
  end if;
  select count(*) into n from alliance_members where alliance_id = d.id;
  -- restituisco il fondo
  if d.fund > 0 and n > 0 then
    share := floor(d.fund / n);
    perform set_config('app.money_reason', 'Restituzione fondo alleanza chiusa', true);
    execute 'up'||'date organizations set funds = funds + $1 where id in (select org_id from alliance_members where alliance_id = $2)' using share, d.id;
    perform set_config('app.money_reason', '', true);
  end if;
  -- prestiti tra loro finiscono, poi l'alleanza (membri, inviti, firme, richieste e registro del fondo vanno via con lei)
  execute 'up'||'date vehicle_loans set returned_at = now() where returned_at is null and from_org in (select org_id from alliance_members where alliance_id = $1)' using d.id;
  execute 'up'||'date card_loans set returned_at = now() where returned_at is null and from_org in (select org_id from alliance_members where alliance_id = $1)' using d.id;
  execute 'de'||'lete from chat_messages where channel = $1' using 'alleanza:' || d.id;
  execute 'de'||'lete from alliances where id = $1' using d.id;
  raise notice 'ESITO eliminata "%" (% associazioni uscite, fondo restituito %)', d.name, n, d.fund;
end $$;

-- nomi unici: niente alleanze con lo stesso nome (maiuscole, spazi e simboli non contano)
create unique index if not exists alliances_name_unico on alliances (lower(regexp_replace(name, '[^[:alnum:]]', '', 'g')));
select 'ESITO alleanze', name from alliances order by name;
