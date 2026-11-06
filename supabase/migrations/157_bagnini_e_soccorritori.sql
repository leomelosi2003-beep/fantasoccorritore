-- 157: bagnini (nuovo ruolo) e nuovi soccorritori per le buste.
-- NB: la prima istruzione (ALTER TYPE ... ADD VALUE) va eseguita e committata DA SOLA,
--     prima del resto, altrimenti Postgres rifiuta l'uso del nuovo valore nella stessa transazione.
-- Parte applicata in due passaggi separati: 157.sql (solo enum) poi 157b.sql (resto).

-- 157: bagnini (nuovo ruolo, solo sulle barche) e nuovi soccorritori per le buste.
-- - aggiunge il valore 'bagnino' all'enum volunteer_role (role_rank lo lascia a 0: non vale sui mezzi di terra)
-- - inserisce volontari nuovi (bagnini + soccorritori base) idonei alle buste
-- - equipaggio barca: 1 bagnino + 1 o 2 soccorritori, niente medici; il bagnino non puo' salire sui mezzi di terra
-- - i servizi in mare mostrano bagnino + soccorritori (niente autista/medico)

-- 1) nuovo ruolo (fuori transazione: dev'essere committato prima di poterlo usare)
alter type volunteer_role add value if not exists 'bagnino';

-- 157b: volontari nuovi + regole barca (dopo l'aggiunta del ruolo 'bagnino').

-- 2) BAGNINI nuovi per le buste (16: 1 leggendario, 3 epici, 12 comuni). Nuoto/resistenza alti, guida bassa.
insert into volunteers (first_name, last_name, nickname, role, rarity,
                        stat_guida, stat_soccorso, stat_resilienza, pros, cons, gender, is_pack_eligible, source)
select
  (array['Marco','Luca','Giulia','Sara','Matteo','Elena','Andrea','Chiara','Davide','Francesca','Alessio','Martina','Simone','Giorgia','Nicola','Valentina'])[i+1],
  (array['Mare','Scogli','Tirreno','Costa','Delfini','Onda','Risacca','Maestri','Scirocco','Libeccio','Gabbiani','Cala','Barbagianni','Pontile','Salsa','Marea'])[i+1],
  (array['Delfino','Tritone','Salvagente','Onda','Corrente','Pinna','Scoglio','Maestrale','Risacca','Squalo','Gabbiano','Poseidone','Libeccio','Scirocco','Bora','Marea'])[i+1],
  'bagnino'::volunteer_role,
  rar,
  (22 + floor(random()*28))::smallint,
  (case rar when 'leggendaria' then 88 when 'epica' then 76 else 55 end + floor(random()* (case rar when 'comune' then 22 else 12 end)))::smallint,
  (case rar when 'leggendaria' then 86 when 'epica' then 74 else 54 end + floor(random()* (case rar when 'comune' then 24 else 14 end)))::smallint,
  array[(array['Nuotatore instancabile','Legge il mare come un libro','Sangue freddo tra le onde','Apnea da record','Conosce ogni secca della costa','Primo a tuffarsi sempre'])[1+(i%6)]],
  array[(array['Scottature facili','Odia il mare mosso','Soffre il mal di mare all''inizio','Sempre in ciabatte','Si distrae a guardare i tramonti','Prende troppo sole'])[1+(i%6)]],
  case when i % 2 = 0 then 'm' else 'f' end,
  true,
  'admin'::content_source
from generate_series(0,15) i
cross join lateral (select (case when i = 0 then 'leggendaria' when i <= 3 then 'epica' else 'comune' end)::rarity as rar) r;

-- 3) SOCCORRITORI base nuovi per le buste (12 comuni, stat casuali)
insert into volunteers (first_name, last_name, nickname, role, rarity,
                        stat_guida, stat_soccorso, stat_resilienza, pros, cons, gender, is_pack_eligible)
select
  (array['Roberto','Ilaria','Fabio','Serena','Tommaso','Alice','Lorenzo','Beatrice','Gabriele','Noemi','Pietro','Camilla'])[i+1],
  (array['Ferri','Lupi','Masi','Conti','Vinci','Rossi','Neri','Grassi','Belli','Fini','Corsi','Dini'])[i+1],
  (array['Barella','Fulmine','Nocchiero','Scheggia','Turbo','Freccia','Roccia','Spugna','Scatto','Molla','Lince','Baldo'])[i+1],
  'soccorritore_base'::volunteer_role,
  'comune'::rarity,
  (28 + floor(random()*32))::smallint,
  (45 + floor(random()*40))::smallint,
  (40 + floor(random()*40))::smallint,
  array[(array['Sempre pronto in sede','Instancabile sui gialli','Calmo nelle urgenze','Fa squadra con tutti','Zero errori sui presidi','Mano ferma sulle medicazioni'])[1+(i%6)]],
  array[(array['Lento a svegliarsi di notte','Fame perenne','Dimentica le chiavi in sede','Troppe pause caffè','Parla troppo in viaggio','Guida nervosa'])[1+(i%6)]],
  case when i % 2 = 0 then 'm' else 'f' end,
  true
from generate_series(0,11) i;

-- 4) claim_mission_as: equipaggio barca + divieto bagnino sui mezzi di terra
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  src2 := src;

  -- il bagnino sale SOLO sulle barche
  src2 := replace(src2,
    'if v_boat then v_comp := null; end if;',
    'if v_boat then v_comp := null; end if;'||E'\n'||
    '  if not v_boat and exists (select 1 from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''bagnino'') then raise exception ''BAGNINO_ONLY_BOAT''; end if;');

  -- equipaggio barca: 1 bagnino + 1/2 soccorritori, niente medici o altri ruoli
  src2 := replace(src2,
    'if (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''autista'') < 1'||E'\n'||
    '       or (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and role_rank(coalesce(ci.role_override, vo.role)) >= 1) < 1 then'||E'\n'||
    '      raise exception ''BOAT_CREW''; end if;',
    'if (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''bagnino'') < 1'||E'\n'||
    '       or (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) in (''soccorritore_base'',''soccorritore_avanzato'')) not between 1 and 2'||E'\n'||
    '       or exists (select 1 from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) not in (''bagnino'',''soccorritore_base'',''soccorritore_avanzato'')) then'||E'\n'||
    '      raise exception ''BOAT_CREW''; end if;');

  if src2 = src then raise exception 'claim_mission_as: patch non applicata'; end if;
  execute src2;
end $$;

-- 5) generate_sea_missions: ruoli richiesti = bagnino + 1/2 soccorritori
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.generate_sea_missions'::regproc), E'\r\n', E'\n');
  src2 := replace(src,
    '''{"autista":1,"soccorritore_avanzato":1}''::jsonb',
    'jsonb_build_object(''bagnino'', 1, ''soccorritore_base'', case when random() < 0.5 then 1 else 2 end)');
  if src2 = src then raise exception 'generate_sea_missions: patch non applicata'; end if;
  execute src2;
end $$;
