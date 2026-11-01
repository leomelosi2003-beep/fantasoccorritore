
-- =====================================================================
--  CARICAMENTO AUTOMATICO DEGLI EVENTI REALI
--  Il database scarica ogni 6 ore le pagine ufficiali (pg_net), le legge
--  e aggiorna il calendario. Gli eventi modificati a mano dall'admin
--  (locked = true) non vengono più toccati.
-- =====================================================================
create extension if not exists pg_net;

create table if not exists event_fetches (
  id          bigserial primary key,
  source      text not null,
  url         text not null,
  request_id  bigint not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  result      text
);

create table if not exists event_sources (
  source text primary key,
  url    text not null,
  label  text not null
);
insert into event_sources (source, url, label) values
  ('calcio',   'https://www.corrieredellosport.it/squadra/calcio/livorno/calendario/t1580', 'US Livorno'),
  ('libertas', 'https://www.legapallacanestro.com/serie-a2/libertas-livorno-1947',         'A2'),
  ('pielle',   'https://www.legapallacanestro.com/serie-b/verodol-cbd-pielle-livorno',     'Serie B'),
  ('goldoni',  'https://www.goldoniteatro.it/spettacoli/',                                  'Teatro Goldoni'),
  ('forum',    'https://www.modiglianiforum.com/tutti-eventi/',                             'Modigliani Forum')
on conflict (source) do update set url = excluded.url, label = excluded.label;

-- Valori predefiniti per tipo di evento
create or replace function event_defaults(p_kind text)
returns table (pre int, dur int, post int, slots int, reward int, roles jsonb)
language sql immutable as $$
  select pre, dur, post, slots, reward, roles from (values
    ('calcio',   60, 110, 20, 2, 6000, '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}'::jsonb),
    ('basket',   45, 120, 15, 1, 3500, '{"autista":1,"soccorritore_base":1}'::jsonb),
    ('concerto', 90, 120, 30, 2, 5000, '{"autista":1,"soccorritore_base":1,"soccorritore_avanzato":1}'::jsonb),
    ('teatro',   30, 150, 15, 1, 2500, '{"autista":1,"soccorritore_base":1}'::jsonb),
    ('altro',    60, 180, 15, 1, 3000, '{"autista":1,"soccorritore_base":1}'::jsonb)
  ) v(kind, pre, dur, post, slots, reward, roles) where kind = p_kind
$$;

create or replace function html_text(s text) returns text language sql immutable as $$
  select btrim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(s,
      '&#8217;', '’'), '&#8216;', '‘'), '&#8211;', '–'), '&#8220;', '“'), '&#8221;', '”'),
      '&amp;', '&'), '&#039;', ''''), '&quot;', '"'), '\s+', ' ', 'g'))
$$;

-- Inserisce o aggiorna un evento letto da una fonte
create or replace function upsert_synced_event(p_key text, p_title text, p_kind text, p_venue text,
                                               p_show timestamptz, p_confirmed boolean, p_url text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare d record; v_id uuid;
begin
  select id into v_id from venues where name = p_venue;
  if v_id is null or p_show is null then return; end if;
  if p_show < now() or p_show > now() + interval '60 days' then return; end if;
  select * into d from event_defaults(p_kind);
  insert into events (source_key, title, kind, venue_id, show_at, starts_at, ends_at, slots,
                      required_roles, requires, reward_funds, time_confirmed, source_url, updated_at)
  values (p_key, left(p_title, 120), p_kind, v_id, p_show,
          p_show - make_interval(mins => d.pre), p_show + make_interval(mins => d.dur + d.post),
          d.slots, d.roles, '{defib}', d.reward, p_confirmed, p_url, now())
  on conflict (source_key) do update
    set title = excluded.title, venue_id = excluded.venue_id, show_at = excluded.show_at,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        time_confirmed = excluded.time_confirmed, source_url = excluded.source_url, updated_at = now()
    where events.locked = false;
end $$;

-- 1) chiede le pagine (pg_net le scarica in background)
create or replace function sync_events_request() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare s record; n int := 0;
begin
  for s in select * from event_sources loop
    insert into event_fetches (source, url, request_id)
    values (s.source, s.url, net.http_get(
      url := s.url,
      headers := '{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36","Accept-Language":"it-IT,it;q=0.9"}'::jsonb,
      timeout_milliseconds := 20000));
    n := n + 1;
  end loop;
  return n;
end $$;

-- 2) legge le pagine arrivate e aggiorna il calendario
create or replace function sync_events_parse() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  f record; html text; st int; r text[]; keys text[]; k text; cnt int; report text := '';
  v_show timestamptz; season int; title text; venue text; js jsonb; pos int; tm text[];
begin
  for f in
    select distinct on (ef.source) ef.*, resp.status_code, resp.content
    from event_fetches ef
    join net._http_response resp on resp.id = ef.request_id
    where ef.processed_at is null
    order by ef.source, ef.requested_at desc
  loop
    html := f.content; st := f.status_code; keys := '{}'; cnt := 0;
    begin
      if st is distinct from 200 or html is null then
        raise exception 'HTTP %', st;
      end if;

      if f.source = 'calcio' then
        for r in select regexp_matches(html,
          '<a href="/live/partita/([a-z0-9-]+)"><div role="row"[^>]*><div role="cell">(?:<img[^>]*>)?([^<]+)</div><div role="cell"><time dateTime="([^"]+)">[^<]*</time></div><div role="cell">([^<]+)<img', 'g')
        loop
          if btrim(r[2]) ilike 'livorno' then
            k := 'calcio:' || r[1];
            perform upsert_synced_event(k, 'Livorno – ' || html_text(r[4]), 'calcio', 'Stadio Armando Picchi',
                                        r[3]::timestamptz, true, f.url);
            keys := keys || k; cnt := cnt + 1;
          end if;
        end loop;

      elsif f.source in ('libertas', 'pielle') then
        for r in select regexp_matches(html,
          '<tr class="(?:odd|even)"><td>(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2})</td><td><a href="[^"]*">([^<]+)</a></td><td><a href="[^"]*">([^<]+)</a></td><td>[^<]*</td><td>([^<]+)</td>', 'g')
        loop
          venue := case when r[8] ilike '%modigliani%' then 'Modigliani Forum'
                        when r[8] ilike '%palamacchia%' then 'PalaMacchia' end;
          if venue is not null then
            v_show := make_timestamptz(r[3]::int, r[2]::int, r[1]::int, r[4]::int, r[5]::int, 0, 'Europe/Rome');
            season := case when r[2]::int >= 8 then r[3]::int else r[3]::int - 1 end;
            k := 'basket:' || lower(html_text(r[6])) || '|' || lower(html_text(r[7])) || '|' || season;
            title := case when f.source = 'libertas' then 'Libertas Livorno – ' else 'Pielle Livorno – ' end
                     || html_text(r[7]) || case when f.source = 'libertas' then ' (A2)' else ' (Serie B)' end;
            perform upsert_synced_event(k, title, 'basket', venue, v_show, true, f.url);
            keys := keys || k; cnt := cnt + 1;
          end if;
        end loop;

      elsif f.source = 'goldoni' then
        for r in select regexp_matches(html,
          '<time datetime="[^"]*">\s*(\d{2})/(\d{2})/(\d{4})\s*</time>\s*<h3>\s*<a href="([^"]+)">([^<]+)</a>\s*</h3>\s*<p class="notes-event">\s*<span[^>]*></span>([^<]+)</p>', 'g')
        loop
          venue := case when r[6] ilike '%goldoni%' then 'Teatro Goldoni'
                        when r[6] ilike '%duomo%' then 'Duomo di Livorno' end;
          if venue is not null then
            v_show := make_timestamptz(r[3]::int, r[2]::int, r[1]::int, 21, 0, 0, 'Europe/Rome');
            title := html_text(r[5]);
            if title = upper(title) then title := initcap(title); end if;
            k := 'goldoni:' || r[4] || '|' || r[3] || r[2] || r[1];
            perform upsert_synced_event(k, title, case when venue = 'Duomo di Livorno' then 'concerto' else 'teatro' end,
                                        venue, v_show, false, r[4]);
            keys := keys || k; cnt := cnt + 1;
          end if;
        end loop;

      elsif f.source = 'forum' then
        for r in select regexp_matches(html, '<script type="application/ld\+json">(.*?)</script>', 'g') loop
          begin js := r[1]::jsonb; exception when others then continue; end;
          if js->>'@type' = 'Event' and js->>'url' is not null and js->>'startDate' is not null then
            -- ora di inizio dalla scheda dell'evento nella pagina
            pos := strpos(html, 'href="' || (js->>'url') || '"');
            tm := case when pos > 0 then regexp_match(substr(html, pos, 4000), 'mec-start-time">(\d{1,2}):(\d{2})') end;
            v_show := make_timestamptz(substr(js->>'startDate', 1, 4)::int, substr(js->>'startDate', 6, 2)::int,
                                     substr(js->>'startDate', 9, 2)::int,
                                     coalesce(tm[1]::int, 21), coalesce(tm[2]::int, 0), 0, 'Europe/Rome');
            k := 'forum:' || (js->>'url');
            perform upsert_synced_event(k, html_text(js->>'name') || ' – Modigliani Forum', 'concerto',
                                        'Modigliani Forum', v_show, tm is not null, js->>'url');
            keys := keys || k; cnt := cnt + 1;
          end if;
        end loop;
      end if;

      -- eventi spariti dalla fonte (rinviati o annullati): via dal calendario
      if cnt > 0 then
        delete from events e
         where e.source_key is not null and not e.locked
           and split_part(e.source_key, ':', 1) = case when f.source in ('libertas','pielle') then 'basket' else f.source end
           and (f.source not in ('libertas','pielle') or e.title like case f.source when 'libertas' then 'Libertas%' else 'Pielle%' end)
           and e.starts_at > now() + interval '2 hours'
           and not (e.source_key = any(keys));
      end if;
      update event_fetches set processed_at = now(), result = 'ok: ' || cnt || ' eventi' where id = f.id;
      report := report || f.source || '=' || cnt || ' ';
    exception when others then
      update event_fetches set processed_at = now(), result = 'errore: ' || sqlerrm where id = f.id;
      report := report || f.source || '=ERRORE(' || sqlerrm || ') ';
    end;
  end loop;
  -- le richieste vecchie mai arrivate si chiudono
  update event_fetches set processed_at = now(), result = 'nessuna risposta'
   where processed_at is null and requested_at < now() - interval '1 hour';
  return coalesce(nullif(report, ''), 'niente da leggere');
end $$;

select cron.unschedule(jobname) from cron.job where jobname in ('sync-events-request', 'sync-events-parse');
select cron.schedule('sync-events-request', '0 */6 * * *', $$select sync_events_request()$$);
select cron.schedule('sync-events-parse', '*/5 * * * *', $$select sync_events_parse()$$);


-- =====================================================================
--  SCOPERTA DI EVENTI NUOVI (fonte aggregata con coordinate)
--  Riconosce anche eventi mai visti e luoghi nuovi: il luogo viene creato
--  sulla mappa dalle coordinate. Gli eventi piccoli (yoga, gite, corsi)
--  vengono scartati. Se l'admin elimina un evento automatico, non torna più.
-- =====================================================================
insert into event_sources (source, url, label) values
  ('allevents', 'https://allevents.in/livorno/all', 'Eventi a Livorno')
on conflict (source) do update set url = excluded.url;

create table if not exists event_blocked_organizers (name text primary key);
insert into event_blocked_organizers (name) values ('Paradisi Da Sogno') on conflict do nothing;
alter table event_blocked_organizers enable row level security;
drop policy if exists "admin organizers" on event_blocked_organizers;
create policy "admin organizers" on event_blocked_organizers for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, delete on event_blocked_organizers to authenticated;

create table if not exists event_ignored (source_key text primary key, ignored_at timestamptz not null default now());

create or replace function remember_deleted_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.source_key is not null and coalesce(current_setting('app.sync', true), '') <> 'on' then
    insert into event_ignored (source_key) values (old.source_key) on conflict do nothing;
  end if;
  return old;
end $$;
drop trigger if exists events_remember_deleted on events;
create trigger events_remember_deleted before delete on events
  for each row execute function remember_deleted_event();

-- Trova un luogo vicino (150 m) o lo crea dalle coordinate
create or replace function venue_for(p_name text, p_lat double precision, p_lng double precision) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; pt geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography; nm text;
begin
  select id into v_id from venues where st_dwithin(location, pt, 150) order by st_distance(location, pt) limit 1;
  if v_id is not null then return v_id; end if;
  nm := left(btrim(regexp_replace(coalesce(nullif(p_name, ''), 'Luogo evento'), ',.*$', '')), 60);
  insert into venues (name, location) values (nm, pt) on conflict (name) do nothing returning id into v_id;
  if v_id is null then
    insert into venues (name, location) values (nm || ' (' || round(p_lat::numeric, 3) || ')', pt)
    on conflict (name) do nothing returning id into v_id;
  end if;
  return v_id;
end $$;

-- Versione con luogo già risolto, durata e numero di ambulanze personalizzabili
create or replace function upsert_synced_event_v(p_key text, p_title text, p_kind text, p_venue_id uuid,
    p_show timestamptz, p_confirmed boolean, p_url text, p_dur int default null, p_slots int default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare d record;
begin
  if p_venue_id is null or p_show is null then return; end if;
  if p_show < now() or p_show > now() + interval '60 days' then return; end if;
  if exists (select 1 from event_ignored where source_key = p_key) then return; end if;
  select * into d from event_defaults(p_kind);
  insert into events (source_key, title, kind, venue_id, show_at, starts_at, ends_at, slots,
                      required_roles, requires, reward_funds, time_confirmed, source_url, updated_at)
  values (p_key, left(p_title, 120), p_kind, p_venue_id, p_show,
          p_show - make_interval(mins => d.pre),
          p_show + make_interval(mins => coalesce(p_dur, d.dur) + d.post),
          coalesce(p_slots, d.slots), d.roles, '{defib}', d.reward * coalesce(p_slots, d.slots) / d.slots,
          p_confirmed, p_url, now())
  on conflict (source_key) do update
    set title = excluded.title, venue_id = excluded.venue_id, show_at = excluded.show_at,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        time_confirmed = excluded.time_confirmed, source_url = excluded.source_url, updated_at = now()
    where events.locked = false;
end $$;

-- La versione per nome luogo ora passa da quella nuova (e rispetta gli eventi eliminati)
create or replace function upsert_synced_event(p_key text, p_title text, p_kind text, p_venue text,
                                               p_show timestamptz, p_confirmed boolean, p_url text)
returns void language sql security definer set search_path = public, extensions as $$
  select upsert_synced_event_v(p_key, p_title, p_kind, (select id from venues where name = p_venue),
                               p_show, p_confirmed, p_url)
$$;

-- Lettura della fonte aggregata: aggiunta come ramo in più di sync_events_parse
create or replace function parse_allevents(html text) returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  r text[]; best text := ''; arr jsonb; e jsonb; cats text[]; kind text; v_show timestamptz; dur int;
  lat double precision; lng double precision; v_id uuid; keys text[] := '{}'; k text; slots int;
begin
  for r in select regexp_matches(html, '_this\.events_data = (\[.*?\]);', 'g') loop
    if length(r[1]) > length(best) then best := r[1]; end if;
  end loop;
  if length(best) < 10 then return keys; end if;
  arr := best::jsonb;
  for e in select * from jsonb_array_elements(arr) loop
    cats := array(select jsonb_array_elements_text(coalesce(e->'custom_params'->'merged_lookup', '[]'::jsonb)));
    -- scarta le attività piccole (yoga, gite, corsi, conferenze, serate di ballo)...
    -- ...tranne i grandi eventi all'aperto, che hanno sempre bisogno di una postazione
    continue when not (cats && array['marathons','running','music-festivals','fireworks'])
              and cats && array['travelling','yoga','meditation','mindfulness','workshops','education','exercise',
                                'fitness','health-wellness','dog','animals','conferences','books','classes','kids',
                                'dance','tango','salsa'];
    -- organizzatori esclusi (es. agenzie di viaggio che partono da Livorno)
    continue when exists (select 1 from event_blocked_organizers b
                          where lower(b.name) = lower(coalesce(e->'organizer'->>'name', '')));
    kind := case
      when cats && array['concerts','live-music','music-festivals'] then 'concerto'
      when cats && array['theatre','performing-arts','opera','comedy'] then 'teatro'
      when cats && array['sports','running','marathons','cycling','football','basketball'] then 'altro'
      when cats && array['festivals','parties','christmas-markets-and-fairs','fairs','food-festivals','fireworks'] then 'altro'
      else null end;
    continue when kind is null;
    lat := nullif(e->'venue'->>'latitude', '')::double precision;
    lng := nullif(e->'venue'->>'longitude', '')::double precision;
    continue when lat is null or lng is null;
    -- solo Livorno e dintorni (circa 15 km dal centro)
    continue when st_distance(st_setsrid(st_makepoint(lng, lat), 4326)::geography,
                              st_setsrid(st_makepoint(10.3106, 43.5485), 4326)::geography) > 15000;
    v_show := to_timestamp((e->>'start_time')::bigint);
    dur := ((e->>'end_time')::bigint - (e->>'start_time')::bigint) / 60;
    if dur < 30 or dur > 720 then dur := null; end if;
    -- doppione di un evento già preso da una fonte ufficiale (stesso giorno, a meno di 400 m)
    continue when exists (
      select 1 from events x join venues v on v.id = x.venue_id
      where (x.source_key is null or x.source_key not like 'allevents:%')
        and (x.show_at at time zone 'Europe/Rome')::date = (v_show at time zone 'Europe/Rome')::date
        and st_dwithin(v.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, 400));
    slots := case when cats && array['marathons','running'] then 3
                  when cats && array['festivals','fireworks','music-festivals'] then 2 end;
    v_id := venue_for(coalesce(nullif(e->>'location', ''), e->'venue'->>'street'), lat, lng);
    k := 'allevents:' || (e->>'event_id');
    perform upsert_synced_event_v(k, html_text(e->>'eventname'), kind, v_id, v_show, false,
                                  split_part(e->>'event_url', '?', 1), dur, slots);
    keys := keys || k;
  end loop;
  return keys;
end $$;

-- sync_events_parse con il ramo "allevents" e la cancellazione silenziosa (non conta come "eliminato dall'admin")
do $do$
declare src text;
begin
  src := pg_get_functiondef('sync_events_parse()'::regprocedure);
  if position('parse_allevents' in src) = 0 then
    src := replace(src,
      'elsif f.source = ''forum'' then',
      'elsif f.source = ''allevents'' then
        keys := parse_allevents(html); cnt := cardinality(keys);

      elsif f.source = ''forum'' then');
    src := replace(src,
      '      if cnt > 0 then
        delete from events e',
      '      if cnt > 0 then
        perform set_config(''app.sync'', ''on'', true);
        delete from events e');
    execute src;
  end if;
end $do$;

-- primo caricamento subito
select sync_events_request();
