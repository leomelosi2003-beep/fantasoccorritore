-- Protezione civile: tutti i moduli che servono (soccorso fluviale, taglio, radio, accoglienza, cucina, NBCR)
-- e scenari che li richiedono. Nessun dato cancellato.
insert into equipment (code, slot, name, cost, provides, effects, description, image_url, sort, category) values
  ('kit_fluviale', 'maxi_fluviale', 'Soccorso fluviale e alluvionale', 75000, '{fluviale}', '{"maxi_bonus":0.3}',
   'Gommone, mute stagne, giubbotti e corde per raggiungere chi è isolato dall''acqua. Serve negli allagamenti, sugli argini e lungo la costa. +30% sulla maxi.', null, 6, 'maxi'),
  ('kit_taglio', 'maxi_taglio', 'Motoseghe e attrezzi da taglio', 45000, '{taglio}', '{"maxi_bonus":0.25}',
   'Motoseghe, troncatrici, divaricatori e puntelli: libera strade da alberi e detriti e apre varchi tra le macerie. Serve per frane, trombe d''aria, neve e terremoti. +25% sulla maxi.', null, 7, 'maxi'),
  ('radio_campo', 'maxi_radio', 'Sala radio mobile e ponte radio', 50000, '{radio}', '{"maxi_bonus":0.2}',
   'Ponte radio portatile, antenne e postazione di coordinamento: tiene in contatto le squadre dove i telefoni non prendono. +20% sulla maxi.', null, 8, 'maxi'),
  ('modulo_accoglienza', 'maxi_accoglienza', 'Tende riscaldate e brandine', 80000, '{accoglienza}', '{"maxi_bonus":0.3}',
   'Tende pneumatiche riscaldate, brandine, coperte e illuminazione: un tetto per gli sfollati e per chi è rimasto al freddo. +30% sulla maxi.', null, 9, 'maxi'),
  ('cucina_campo', 'maxi_cucina', 'Cucina da campo', 55000, '{cucina}', '{"maxi_bonus":0.2}',
   'Cucina mobile con fornelli, pentoloni e scorte: pasti caldi per sfollati e volontari. +20% sulla maxi.', null, 10, 'maxi'),
  ('modulo_nbcr', 'maxi_nbcr', 'Modulo NBCR (rischio chimico)', 90000, '{nbcr}', '{"maxi_bonus":0.35}',
   'Tute protettive, rilevatori di gas e doccia di decontaminazione: per nubi tossiche e incidenti con sostanze pericolose. +35% sulla maxi.', null, 11, 'maxi')
on conflict (code) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost, provides = excluded.provides,
  effects = excluded.effects, description = excluded.description, sort = excluded.sort, category = excluded.category;

create or replace function public.pc_scenario(OUT kind text, OUT t text, OUT d text, OUT req text[], OUT hours integer, OUT code text, OUT reward integer)
 returns record language sql as $function$
  select * from (values
    ('ricerca', 'Ricerca di un escursionista disperso', 'Un escursionista non è rientrato dal sentiero. Servono squadre cinofile o droni con termocamera per battere la zona, e una sala radio per coordinare le squadre.', '{cinofila,droni,radio}'::text[], 3, 'giallo', 30000),
    ('ricerca', 'Anziano scomparso da casa', 'Un anziano con problemi di memoria è uscito di casa e non è tornato. Cani molecolari e droni per cercarlo nei campi e nei boschi.', '{cinofila,droni,radio}', 2, 'rosso', 32000),
    ('ricerca', 'Fungaiolo disperso nel bosco', 'Un cercatore di funghi non risponde al telefono dal pomeriggio. Ricerca con cani e droni prima che faccia buio.', '{cinofila,droni,radio}', 3, 'giallo', 30000),
    ('macerie', 'Crollo di una palazzina: ricerca sotto le macerie', 'Possibili persone sotto le macerie. Servono unità cinofile e droni per localizzarle, attrezzi da taglio per aprire varchi e la logistica per illuminare il cantiere.', '{cinofila,droni,logistica,taglio}', 4, 'rosso', 38000),
    ('allagamento', 'Allerta rossa: quartiere allagato', 'Strade e scantinati allagati dopo il nubifragio. Pompe idrovore per l''acqua, gommoni per chi è isolato, la logistica con generatori e torri faro, i droni sugli argini.', '{pompa,fluviale,logistica,droni}', 4, 'giallo', 28000),
    ('argine', 'Sorveglianza di un argine a rischio', 'Il fiume è vicino al livello di guardia. Droni per controllare l''argine dall''alto, squadre fluviali pronte e la logistica per illuminare la zona di notte.', '{droni,logistica,fluviale}', 3, 'giallo', 26000),
    ('frana', 'Frana sulla strada provinciale', 'Una frana ha isolato alcune case. Droni per valutare il fronte, cani per verificare che nessuno sia coinvolto, motoseghe per liberare la strada dagli alberi.', '{droni,cinofila,taglio}', 3, 'giallo', 30000),
    ('accoglienza', 'Campo di accoglienza per gli sfollati', 'Famiglie evacuate da sistemare: servono tende e brandine, la cucina da campo, la logistica (generatori e luce) e un PMA per l''assistenza sanitaria.', '{accoglienza,cucina,logistica,pma}', 5, 'verde', 34000),
    ('freddo', 'Ondata di gelo e black-out', 'Paese senza corrente da ore: generatori e luce, tende riscaldate e pasti caldi per le persone più fragili.', '{logistica,accoglienza,cucina}', 4, 'verde', 24000),
    ('evento', 'Supporto a una manifestazione pubblica', 'Grande manifestazione all''aperto: servono torre faro e generatori (logistica), un PMA per il primo soccorso e la radio per coordinare le postazioni.', '{logistica,pma,radio}', 4, 'verde', 22000),
    ('mare', 'Ricerca lungo la costa', 'Un bagnante non è rientrato. I droni sorvolano la scogliera e le calette, le squadre fluviali col gommone controllano gli scogli.', '{droni,fluviale}', 2, 'rosso', 28000),
    ('vento', 'Tromba d''aria: alberi e tetti abbattuti', 'Alberi caduti sulle strade e tetti scoperchiati. Motoseghe per liberare le strade, la logistica con teli e generatori, i droni per controllare i danni.', '{taglio,logistica,droni}', 3, 'giallo', 30000),
    ('terremoto', 'Terremoto: crolli e persone da cercare', 'Una forte scossa ha danneggiato il centro del paese. Cani e attrezzi da taglio tra le macerie, sala radio per coordinare, PMA per i feriti e logistica per il campo base.', '{cinofila,taglio,radio,pma,logistica}', 5, 'rosso', 42000),
    ('nbcr', 'Nube tossica da un capannone in fiamme', 'Un incendio in un capannone industriale sprigiona fumi pericolosi. Serve il modulo NBCR (tute, rilevatori, decontaminazione) e i droni per seguire la nube.', '{nbcr,droni}', 3, 'rosso', 36000),
    ('neve', 'Nevicata eccezionale: strade bloccate', 'Neve e alberi caduti hanno isolato le frazioni. Motoseghe per riaprire le strade, generatori e tende riscaldate per chi è rimasto al freddo.', '{taglio,logistica,accoglienza}', 4, 'verde', 26000)
  ) v(kind, t, d, req, hours, code, reward)
  order by random() limit 1
$function$;

do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.spawn_pc_mission'::regproc), E'\r\n', E'\n');
  if position('modulo NBCR' in src) = 0 then
    src := replace(src, $$when 'pompa' then '💧 pompa idrovora' end$$,
      $$when 'pompa' then '💧 pompa idrovora' when 'fluviale' then '🚤 soccorso fluviale' when 'taglio' then '🪚 attrezzi da taglio' when 'radio' then '📡 sala radio' when 'accoglienza' then '🏕️ tende e brandine' when 'cucina' then '🍲 cucina da campo' when 'nbcr' then '☣️ modulo NBCR' end$$);
    if position('modulo NBCR' in src) = 0 then raise exception 'patch spawn_pc_mission non applicata'; end if;
    execute src;
  end if;
end $d$;
notify pgrst, 'reload schema';
select 'ESITO moduli', count(*) from equipment where category = 'maxi';
