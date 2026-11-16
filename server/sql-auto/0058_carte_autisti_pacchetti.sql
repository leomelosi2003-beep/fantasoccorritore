-- Nuove carte (autisti, autisti avanzati e altri ruoli) e pacchetti specialisti per autisti / autisti avanzati.
-- Nessun dato esistente toccato: si aggiungono solo volontari nuovi e voci di catalogo.
do $$
declare
  fm text[] := array['Alessio','Andrea','Antonio','Bruno','Carlo','Claudio','Cristian','Daniele','Dario','Diego','Elia','Fabio',
    'Fabrizio','Gianluca','Giulio','Ivan','Kevin','Lapo','Leonardo','Mattia','Mirko','Nicolò','Omar','Patrizio','Raffaele','Renato',
    'Sergio','Tiziano','Umberto','Walter','Yuri','Zeno','Ettore','Ferdinando','Guido','Ruggero'];
  ff text[] := array['Agnese','Aurora','Bianca','Carlotta','Cecilia','Debora','Diletta','Eleonora','Erika','Fiamma','Giuditta',
    'Greta','Isabella','Jessica','Lara','Letizia','Ludovica','Margherita','Michela','Miriam','Nadia','Ornella','Paola','Rachele',
    'Roberta','Serena','Simona','Stella','Tamara','Teresa','Vanessa','Vittoria','Ylenia','Zoe'];
  ln text[] := array['Abati','Agostini','Allegrini','Bagnoli','Bandini','Barontini','Bechelli','Bellini','Bencini','Bernardini',
    'Bertolucci','Betti','Boschi','Brogi','Bucci','Burchielli','Calamai','Campani','Cantini','Carli','Casini','Cerri','Chelli',
    'Cioni','Ciampi','Corsi','Cosci','Dani','Del Lungo','Della Santina','Dini','Fantozzi','Fedi','Frosini','Gambini','Ghelardini',
    'Giannini','Giuntini','Landi','Lami','Lemmi','Lippi','Maestrini','Malloggi','Mannucci','Marianelli','Matteoli','Menicagli',
    'Mori','Nannipieri','Orlandi','Pardini','Parrini','Pierotti','Pratesi','Profeti','Ricci','Salvadori','Scotto','Sodi','Spinelli',
    'Taddei','Tamberi','Tinghi','Turini','Vaglini','Vanni','Venturi','Zucconi'];
  nick jsonb := '{
    "autista": ["Volante","Pedale","Sgommata","Marcia","Frizione","Retromarcia","Navigatore","Rotonda","Corsia","Sorpasso","Cambio","Clacson","Specchietto","Parcheggio","Cruscotto"],
    "autista_av": ["Pilota","Turbo","Sirena Blu","Doppia Guida","Freccia","Scia","Curva","Tachimetro","Lampo","Bolide","Slalom","Controsterzo","Cronometro","Pole","Rally"],
    "soccorritore_base": ["Coperta","Ghiaccio","Termometro","Guanti","Mascherina"],
    "soccorritore_avanzato": ["Pallone","Cannula","Ferula","Tourniquet","Saturo"],
    "infermiere": ["Drip","Benda","Prelievo","Catetere","Garzina"],
    "medico": ["Stetoscopio","Ecg","Consulto","Intubazione","Camice"],
    "caposervizio": ["Capo","Radio","Centrale","Coordinatore","Turno","Briefing","Comandante","Fischio","Registro","Cartellino"]
  }';
  -- (ruolo, avanzato, quanti)
  plan jsonb := '[["autista",false,30],["autista",true,30],["soccorritore_base",false,15],["soccorritore_avanzato",false,15],
                  ["infermiere",false,15],["medico",false,15],["caposervizio",false,10]]';
  it jsonb; r text; adv boolean; tot int; i int; rar rarity; g char; fn text; la text; base record; pr text[]; co text[];
  sg int; ss int; sr int; tm jsonb; tries int; nk text; nl jsonb; made int := 0;
begin
  if exists (select 1 from volunteers where nickname = 'Sgommata') then return; end if;   -- già eseguita
  for it in select * from jsonb_array_elements(plan) loop
    r := it->>0; adv := (it->>1)::boolean; tot := (it->>2)::int;
    nl := nick->(case when r = 'autista' and adv then 'autista_av' else r end);
    for i in 1..tot loop
      rar := case when i <= round(tot * 0.8) then 'comune' when i < tot then 'epica' else 'leggendaria' end;
      select round(avg(stat_guida)) gu, round(avg(stat_soccorso)) so, round(avg(stat_resilienza)) re into base
        from volunteers where role = r::volunteer_role and rarity = rar and (r <> 'autista' or avanzato = adv);
      sg := least(100, greatest(5, coalesce(base.gu, 55) + floor(random() * 17 - 8)::int));
      ss := least(100, greatest(5, coalesce(base.so, 55) + floor(random() * 17 - 8)::int));
      sr := least(100, greatest(5, coalesce(base.re, 55) + floor(random() * 17 - 8)::int));
      tries := 0;
      loop
        g := case when random() < 0.5 then 'm' else 'f' end;
        fn := case g when 'm' then fm[1 + floor(random() * array_length(fm, 1))::int] else ff[1 + floor(random() * array_length(ff, 1))::int] end;
        la := ln[1 + floor(random() * array_length(ln, 1))::int];
        tries := tries + 1;
        exit when tries > 60 or not exists (select 1 from volunteers where first_name = fn and last_name = la);
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
      nk := nl->>((i - 1) % jsonb_array_length(nl));
      insert into volunteers (first_name, last_name, nickname, role, rarity, gender, stat_guida, stat_soccorso, stat_resilienza,
                              pros, cons, trait_mods, is_pack_eligible, source, avanzato, shop_price)
      values (fn, la, nk, r::volunteer_role, rar, g, sg, ss, sr, pr, co, tm, true,
              case when rar = 'comune' then 'ai' else 'admin' end::content_source, (r = 'autista' and adv),
              case when rar = 'leggendaria' then (sg + ss + sr) * 1000 + 80000 end);
      made := made + 1;
    end loop;
  end loop;
  raise notice 'ESITO carte nuove: %', made;
end $$;

-- catalogo: i due pacchetti nuovi si aggiungono a quelli che ci sono già (prezzi attuali invariati)
do $$
declare cur jsonb := pack_catalog(); add jsonb := '[]';
begin
  if not exists (select 1 from jsonb_array_elements(cur) x where x->>'kind' = 'ruolo_autista') then
    add := add || '[{"kind":"ruolo_autista","role":"autista","avanzato":false,"price":35000,"leg":0.03,"epi":0.17,"guarantee":null}]'::jsonb;
  end if;
  if not exists (select 1 from jsonb_array_elements(cur) x where x->>'kind' = 'ruolo_autista_avanzato') then
    add := add || '[{"kind":"ruolo_autista_avanzato","role":"autista","avanzato":true,"price":55000,"leg":0.03,"epi":0.17,"guarantee":null}]'::jsonb;
  end if;
  execute format('create or replace function public.pack_catalog() returns jsonb language sql stable as %L',
                 'select ' || quote_literal((cur || add)::text) || '::jsonb');
end $$;
grant execute on function public.pack_catalog() to anon, authenticated;

-- buy_pack: i pacchetti autista distinguono autisti normali e avanzati
do $$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.buy_pack(text)'::regprocedure), E'\r\n', E'\n');
  if position('v_adv' in src) > 0 then return; end if;
  n := replace(src, 'v_role volunteer_role;', 'v_role volunteer_role; v_adv boolean;');
  n := replace(n, 'v_role := (cat->>''role'')::volunteer_role;', 'v_role := (cat->>''role'')::volunteer_role; v_adv := (cat->>''avanzato'')::boolean;');
  n := replace(n, '(v_role is null or role = v_role)', '(v_role is null or role = v_role) and (v_adv is null or avanzato = v_adv)');
  n := replace(n, 'and role = v_role order by random()', 'and role = v_role and (v_adv is null or avanzato = v_adv) order by random()');
  n := replace(n, 'where role = v_role and is_pack_eligible', 'where role = v_role and (v_adv is null or avanzato = v_adv) and is_pack_eligible');
  if position('v_adv := ' in n) = 0 or position('(v_adv is null or avanzato = v_adv)' in n) = 0 then raise exception 'buy_pack non patchata'; end if;
  execute n;
end $$;

-- quanti ne restano da trovare: autisti avanzati contati a parte
create or replace function public.pack_role_availability()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (
    select case when v.role = 'autista' and v.avanzato then 'autista_avanzato' else v.role::text end role, count(*) n from volunteers v
     where v.is_pack_eligible
       and v.id not in (select volunteer_id from card_inventory where org_id = my_org_id() and state <> 'scaduta')
     group by 1) x
$$;
grant execute on function public.pack_role_availability() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO pacchetti', (select count(*) from jsonb_array_elements(pack_catalog()) x where x->>'kind' like 'ruolo_autista%');
