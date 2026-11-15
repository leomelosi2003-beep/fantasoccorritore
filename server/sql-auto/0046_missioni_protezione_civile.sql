-- 246: missioni di Protezione Civile (venue 'PC'): ricerca dispersi, macerie, allagamenti, campi di accoglienza...
-- Ci vanno solo i mezzi maxi (camion / furgone) con il modulo giusto (droni, cinofila, logistica, PMA).
create or replace function public.pc_scenario(out kind text, out t text, out d text, out req text[], out hours int, out code text, out reward int)
language sql volatile as $f$
  select * from (values
    ('ricerca', 'Ricerca di un escursionista disperso', 'Un escursionista non è rientrato dal sentiero. Servono squadre cinofile o droni con termocamera per battere la zona.', '{cinofila,droni}'::text[], 3, 'giallo', 30000),
    ('ricerca', 'Anziano scomparso da casa', 'Un anziano con problemi di memoria è uscito di casa e non è tornato. Cani molecolari e droni per cercarlo nei campi e nei boschi.', '{cinofila,droni}', 2, 'rosso', 32000),
    ('ricerca', 'Fungaiolo disperso nel bosco', 'Un cercatore di funghi non risponde al telefono dal pomeriggio. Ricerca con cani e droni prima che faccia buio.', '{cinofila,droni}', 3, 'giallo', 30000),
    ('macerie', 'Crollo di una palazzina: ricerca sotto le macerie', 'Possibili persone sotto le macerie. Servono unità cinofile e droni per localizzarle, la logistica per illuminare e alimentare il cantiere.', '{cinofila,droni,logistica}', 4, 'rosso', 38000),
    ('allagamento', 'Allerta rossa: quartiere allagato', 'Strade e scantinati allagati dopo il nubifragio. La logistica porta pompe, generatori e torri faro; i droni controllano argini e zone isolate.', '{logistica,droni}', 4, 'giallo', 28000),
    ('argine', 'Sorveglianza di un argine a rischio', 'Il fiume è vicino al livello di guardia. Droni per controllare l''argine dall''alto e la logistica per illuminare la zona di notte.', '{droni,logistica}', 3, 'giallo', 26000),
    ('frana', 'Frana sulla strada provinciale', 'Una frana ha isolato alcune case. Droni per valutare il fronte della frana e cani per verificare che nessuno sia rimasto coinvolto.', '{droni,cinofila}', 3, 'giallo', 30000),
    ('accoglienza', 'Campo di accoglienza per gli sfollati', 'Famiglie evacuate da allestire in una tendopoli: servono la logistica (tende, generatori, ristoro) e un PMA per l''assistenza sanitaria.', '{logistica,pma}', 5, 'verde', 34000),
    ('freddo', 'Ondata di gelo e black-out', 'Paese senza corrente da ore: la logistica porta generatori, luce e bevande calde alle persone più fragili.', '{logistica}', 4, 'verde', 24000),
    ('evento', 'Supporto a una manifestazione pubblica', 'Grande manifestazione all''aperto: servono torre faro e generatori (logistica) e un PMA per il primo soccorso.', '{logistica,pma}', 4, 'verde', 22000),
    ('mare', 'Ricerca lungo la costa', 'Un bagnante non è rientrato. I droni sorvolano la scogliera e le calette in attesa dei mezzi via mare.', '{droni}', 2, 'rosso', 28000)
  ) v(kind, t, d, req, hours, code, reward)
  order by random() limit 1
$f$;

create or replace function public.spawn_pc_mission() returns uuid
language plpgsql security definer set search_path = public, extensions as $f$
declare bl geography; bname text; loc geography; zname text; sc record; mid uuid; nm text;
begin
  -- vicino a una sede di chi ha mezzi maxi (se nessuno li ha, una sede qualsiasi): così i moduli servono davvero
  select b.location, b.name into bl, bname from bases b
   where exists (select 1 from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = b.org_id and coalesce(vm.maxi, false))
   order by random() limit 1;
  if bl is null then select b.location, b.name into bl, bname from bases b order by random() limit 1; end if;
  if bl is null then return null; end if;
  select s.location, s.name into loc, zname from (
    select comune as name, location from mission_spots where st_dwithin(location, bl, 30000)
    union all select comune, location from mission_spots_toscana where st_dwithin(location, bl, 30000)
    union all select comune, location from mission_spots_trentino where st_dwithin(location, bl, 30000)
    union all select city, location from italy_spots where st_dwithin(location, bl, 30000)
  ) s order by random() limit 1;
  if loc is null then loc := bl; zname := bname; end if;
  select * into sc from pc_scenario();
  if sc.kind in ('ricerca', 'frana', 'argine') then loc := st_project(loc, 1500 + random() * 3000, random() * 2 * pi())::geography; end if;
  nm := (select string_agg(case x when 'cinofila' then '🐕 cinofila' when 'droni' then '🛸 droni' when 'logistica' then '⚡ logistica' when 'pma' then '⛺ PMA' end, ' o ')
           from unnest(sc.req) x);
  insert into missions (category, code, title, description, venue, location, slots_total, required_roles,
                        min_certification, duration_minutes, base_fatigue, reward_funds, reward_reputation,
                        requires, opens_at, expires_at, source, event_ends_at)
  values ('grande_evento', sc.code::mission_code, '🦺 PROTEZIONE CIVILE: ' || sc.t || ' — ' || zname,
          sc.d || ' Possono andare i camion e i furgoni maxi con almeno uno di questi moduli: ' || nm || '. Dura circa ' || sc.hours || ' ore.',
          'PC', loc, 8, '{"autista":1,"soccorritore_base":1}'::jsonb, 'base', sc.hours * 60, 6, sc.reward, 8, sc.req,
          now(), now() + make_interval(hours => sc.hours), 'scheduler', now() + make_interval(hours => sc.hours))
  returning id into mid;
  return mid;
end $f$;

-- una ogni tanto (al massimo 3 aperte insieme, almeno 2 ore tra una e l'altra): agganciata al giro degli incendi (ogni minuto)
create or replace function public.spawn_pc_if_due() returns void
language plpgsql security definer set search_path = public, extensions as $f$
begin
  if (select count(*) from missions where venue = 'PC' and category = 'grande_evento' and event_ends_at > now()) >= 3 then return; end if;
  if exists (select 1 from missions where venue = 'PC' and category = 'grande_evento' and created_at > now() - interval '2 hours') then return; end if;
  if random() < 0.012 then perform spawn_pc_mission(); end if;
end $f$;

do $$
declare src text; n text;
begin
  src := pg_get_functiondef('public.tick_wildfires'::regproc);
  n := replace(src, '  perform spread_wildfires();', '  perform spread_wildfires();
  perform spawn_pc_if_due();');
  if n = src then raise exception 'tick_wildfires non patchata'; end if;
  execute n;

  -- invio: solo mezzi maxi, con almeno un modulo richiesto
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'then raise exception ''MAXI_ONLY''; end if;', 'then raise exception ''MAXI_ONLY''; end if;
  if m.category = ''grande_evento'' and m.event_id is null and m.venue = ''PC'' then
    if not v_maxi then raise exception ''PC_NEEDS_MAXI''; end if;
    if coalesce(array_length(m.requires, 1), 0) > 0
       and not exists (select 1 from equipment e where e.code = any(veh.equipment) and e.provides && m.requires::text[]) then raise exception ''PC_NEEDS_MODULE''; end if;
  end if;');
  if n = src then raise exception 'claim_mission_as non patchata'; end if;
  execute n;

  -- la maxi settimanale guarda solo le maxi vere (non le missioni di protezione civile)
  src := pg_get_functiondef('public.spawn_maxi_if_due'::regproc);
  n := replace(replace(src, 'and coalesce(venue, '''') <> ''AIB''
             and (status', 'and coalesce(venue, '''') not in (''AIB'', ''PC'')
             and (status'), 'where category=''grande_evento'' and event_id is null and coalesce(venue, '''') <> ''AIB'';',
             'where category=''grande_evento'' and event_id is null and coalesce(venue, '''') not in (''AIB'', ''PC'');');
  if n = src then raise exception 'spawn_maxi_if_due non patchata'; end if;
  execute n;
end $$;
-- la prima subito, per provarla
select 'ESITO pc', left(title, 90) from missions where id = spawn_pc_mission();
