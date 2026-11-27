-- 0257: nuovi volontari nei pacchetti, così anche le associazioni più grandi trovano sempre carte nuove.
-- 775 volontari: 160 autisti (30% autisti avanzati), 150 soccorritori base, 150 avanzati, 90 infermieri, 80 medici,
-- 60 bagnini, 60 AIB, 25 capiservizio. Circa 84% comuni, 13% epici, 3% leggendari, statistiche vicine alla media del ruolo.
-- Nessun dato esistente toccato.
do $$
declare
  fm text[] := array['Alessandro','Andrea','Antonio','Davide','Edoardo','Emanuele','Enrico','Federico','Filippo','Francesco',
    'Gabriele','Giacomo','Giorgio','Giovanni','Jacopo','Leonardo','Lorenzo','Luca','Manuel','Marco','Matteo','Michele',
    'Niccolo','Nicola','Paolo','Pietro','Riccardo','Roberto','Samuele','Simone','Stefano','Tommaso','Valerio','Vittorio'];
  ff text[] := array['Alessia','Alice','Anna','Arianna','Beatrice','Camilla','Caterina','Chiara','Elena','Elisa','Emma',
    'Federica','Francesca','Gaia','Giada','Ginevra','Giorgia','Giulia','Ilaria','Irene','Laura','Lucia','Marta','Martina',
    'Matilde','Noemi','Rebecca','Sara','Silvia','Sofia','Valentina','Veronica','Viola'];
  ln text[] := array['Bartolini','Bacci','Baldi','Barsotti','Benedetti','Bertini','Bianchi','Biagini','Bonini','Borghi',
    'Bruni','Caciagli','Cappelli','Cecchi','Ceccarelli','Conti','Corsini','Del Bono','Del Corso','Fabbri','Falchi','Ferri',
    'Fiaschi','Franchi','Galli','Gori','Guidi','Innocenti','Lazzeri','Lenzi','Lombardi','Lotti','Lucchesi','Mancini',
    'Martelli','Masi','Mazzei','Meucci','Montanelli','Nardi','Neri','Niccolai','Orsini','Pacini','Pagni','Paoli','Parenti',
    'Pellegrini','Puccini','Rossi','Sani','Santini','Sbrana','Simoncini','Soldani','Tognetti','Tosi','Vannucci','Vestri','Vitali',
    'Agostini','Bandini','Batini','Bellini','Benvenuti','Bernardini','Boschi','Bracci','Cantini','Carli','Casini','Catani','Chelli',
    'Cipriani','Colombini','Crescioli','Dami','Del Seppia','Di Batte','Fanucci','Ferretti','Fontanelli','Frosini','Gelli','Giannini',
    'Granchi','Lami','Landi','Lupi','Macchi','Magnani','Marchetti','Mariotti','Melani','Menichetti','Moretti','Nannini','Nesti',
    'Paolini','Pardini','Pieri','Pratesi','Rindi','Rossetti','Salvini','Sardelli','Scotto','Signorini','Tamburini','Turchi','Ulivieri','Zucchi'];
  nick jsonb := '{
    "autista": ["Volante","Pedale","Freccia","Curva","Turbo","Marcia","Frizione","Navigatore","Pista","Rotonda"],
    "caposervizio": ["Capo","Regia","Bussola","Radio","Comando","Turno","Coordinatore","Faro","Timone","Ordine"],
    "soccorritore_base": ["Cerotto","Barella","Lampeggiante","Primo Soccorso","Garza","Sirena","Telo","Laccio","Zaino","Bende"],
    "soccorritore_avanzato": ["Ambu","DAE","Collare","Spinale","Tavola","Saturimetro","Ossigeno","Aspiratore","Ragno","Steccobenda"],
    "infermiere": ["Flebo","Ago","Siringa","Triage","Accesso","Glicemia","Cannula","Pompa","Fiala","Infusione"],
    "medico": ["Bisturi","Diagnosi","Ecografo","Laringoscopio","Defibrillatore","Primario","Sutura","Anestesia","Referto","Dottore"],
    "bagnino": ["Squalo","Onda","Boa","Marea","Scoglio","Pinna","Tavola","Salvagente","Corrente","Fischietto"],
    "aib": ["Brace","Fumo","Pala","Lancia","Idrante","Cenere","Scintilla","Vento","Pino","Pompa"]
  }';
  roles text[] := array['autista','soccorritore_base','soccorritore_avanzato','infermiere','medico','bagnino','aib','caposervizio'];
  quanti int[] := array[160, 150, 150, 90, 80, 60, 60, 25];  -- volontari nuovi per ruolo (stesso ordine)
  k int; tot int;
  r text; i int; rar rarity; g char; fn text; la text; base record; pr text[]; co text[];
  sg int; ss int; sr int; tm jsonb; tries int;
begin
  for k in 1..array_length(roles, 1) loop
    r := roles[k]; tot := quanti[k];
    for i in 1..tot loop
      -- circa 84% comuni, 13% epiche, 3% leggendarie
      rar := case when i % 33 = 0 then 'leggendaria' when i % 8 = 0 then 'epica' else 'comune' end;
      select round(avg(stat_guida)) gu, round(avg(stat_soccorso)) so, round(avg(stat_resilienza)) re into base
        from volunteers where role = r::volunteer_role and rarity = rar;
      sg := least(100, greatest(5, coalesce(base.gu, 50) + floor(random() * 17 - 8)::int));
      ss := least(100, greatest(5, coalesce(base.so, 60) + floor(random() * 17 - 8)::int));
      sr := least(100, greatest(5, coalesce(base.re, 55) + floor(random() * 17 - 8)::int));
      -- nome non gia' usato
      tries := 0;
      loop
        g := case when random() < 0.5 then 'm' else 'f' end;
        fn := case g when 'm' then fm[1 + floor(random() * array_length(fm, 1))::int] else ff[1 + floor(random() * array_length(ff, 1))::int] end;
        la := ln[1 + floor(random() * array_length(ln, 1))::int];
        tries := tries + 1;
        exit when tries > 200 or not exists (select 1 from volunteers where first_name = fn and last_name = la);
      end loop;
      select coalesce(array_agg(p), '{}') into pr from (
        select p from (select distinct unnest(pros) p from volunteers where role = r::volunteer_role) x
         order by random() limit case when rar = 'comune' then 1 else 2 end) y;
      select coalesce(array_agg(c), '{}') into co from (
        select c from (select distinct unnest(cons) c from volunteers where role = r::volunteer_role) x
         order by random() limit 1) y;
      tm := case rar when 'comune' then '{}'::jsonb
                     when 'epica' then jsonb_build_object(case when random() < 0.5 then 'rosso_fatigue' else 'night_fatigue' end, -0.1)
                     else '{"rosso_fatigue": -0.15, "night_fatigue": -0.1}'::jsonb end;
      insert into volunteers (first_name, last_name, nickname, role, rarity, gender, stat_guida, stat_soccorso, stat_resilienza,
                              pros, cons, trait_mods, is_pack_eligible, source, avanzato, shop_price)
      values (fn, la, nick->r->>((i - 1) % 10), r::volunteer_role, rar, g, sg, ss, sr, pr, co, tm, true,
              case when rar = 'comune' then 'ai' else 'admin' end::content_source, r = 'autista' and random() < 0.3,
              case when rar = 'leggendaria' then (sg + ss + sr) * 1000 + 80000 end);
    end loop;
  end loop;
end $$;

do $$ begin raise notice 'ESITO volontari nel mazzo adesso: %', (select string_agg(role::text || ' ' || n, ', ' order by role) from (
  select role, count(*) n from volunteers where is_pack_eligible group by role) x); end $$;
