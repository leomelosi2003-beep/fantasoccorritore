-- 185: piu' volontari e pacchetti "specialisti" per ruolo.
-- 1) 180 volontari nuovi (30 per ruolo: soccorritore base/avanzato, infermiere, medico, bagnino, AIB),
--    per ruolo 24 comuni, 5 epici, 1 leggendario. Statistiche vicine alla media del loro ruolo/rarita',
--    pregi e difetti presi da quelli gia' esistenti dello stesso ruolo. Nessun dato esistente toccato.
-- 2) Pacchetti per ruolo nel negozio (5 volontari tutti dello stesso ruolo), molto piu' cari del comune.
-- 3) buy_pack filtra per ruolo; pack_role_availability() dice quanti ne restano da trovare per ruolo.

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
    'Pellegrini','Puccini','Rossi','Sani','Santini','Sbrana','Simoncini','Soldani','Tognetti','Tosi','Vannucci','Vestri','Vitali'];
  nick jsonb := '{
    "soccorritore_base": ["Cerotto","Barella","Lampeggiante","Primo Soccorso","Garza","Sirena","Telo","Laccio","Zaino","Bende"],
    "soccorritore_avanzato": ["Ambu","DAE","Collare","Spinale","Tavola","Saturimetro","Ossigeno","Aspiratore","Ragno","Steccobenda"],
    "infermiere": ["Flebo","Ago","Siringa","Triage","Accesso","Glicemia","Cannula","Pompa","Fiala","Infusione"],
    "medico": ["Bisturi","Diagnosi","Ecografo","Laringoscopio","Defibrillatore","Primario","Sutura","Anestesia","Referto","Dottore"],
    "bagnino": ["Squalo","Onda","Boa","Marea","Scoglio","Pinna","Tavola","Salvagente","Corrente","Fischietto"],
    "aib": ["Brace","Fumo","Pala","Lancia","Idrante","Cenere","Scintilla","Vento","Pino","Pompa"]
  }';
  roles text[] := array['soccorritore_base','soccorritore_avanzato','infermiere','medico','bagnino','aib'];
  r text; i int; rar rarity; g char; fn text; la text; base record; pr text[]; co text[];
  sg int; ss int; sr int; tm jsonb; tries int;
begin
  if exists (select 1 from volunteers where created_at::date = current_date and source in ('ai','admin')
             and nickname = 'Cerotto') then return; end if;  -- gia' eseguita
  foreach r in array roles loop
    for i in 1..30 loop
      rar := case when i <= 24 then 'comune' when i <= 29 then 'epica' else 'leggendaria' end;
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
        exit when tries > 50 or not exists (select 1 from volunteers where first_name = fn and last_name = la);
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
              case when rar = 'comune' then 'ai' else 'admin' end::content_source, false,
              case when rar = 'leggendaria' then (sg + ss + sr) * 1000 + 80000 end);
    end loop;
  end loop;
end $$;

-- Catalogo: pacchetti normali + specialisti (stesse probabilita' del comune, un po' meglio)
create or replace function public.pack_catalog()
returns jsonb language sql stable as $$
  select '[
    {"kind":"comune",      "price":4500,  "leg":0.02, "epi":0.13, "guarantee":null},
    {"kind":"epico",       "price":17000, "leg":0.08, "epi":0.42, "guarantee":"epica"},
    {"kind":"leggendario", "price":52000, "leg":0.25, "epi":0.50, "guarantee":"leggendaria"},
    {"kind":"ruolo_soccorritore_base",     "role":"soccorritore_base",     "price":40000,  "leg":0.03, "epi":0.17, "guarantee":null},
    {"kind":"ruolo_soccorritore_avanzato", "role":"soccorritore_avanzato", "price":60000,  "leg":0.03, "epi":0.17, "guarantee":null},
    {"kind":"ruolo_infermiere",            "role":"infermiere",            "price":90000,  "leg":0.03, "epi":0.17, "guarantee":null},
    {"kind":"ruolo_medico",                "role":"medico",                "price":120000, "leg":0.03, "epi":0.17, "guarantee":null},
    {"kind":"ruolo_bagnino",               "role":"bagnino",               "price":80000,  "leg":0.03, "epi":0.17, "guarantee":null},
    {"kind":"ruolo_aib",                   "role":"aib",                   "price":80000,  "leg":0.03, "epi":0.17, "guarantee":null}
  ]'::jsonb $$;
grant execute on function public.pack_catalog() to anon, authenticated;

create or replace function public.buy_pack(p_kind text)
returns setof card_inventory language plpgsql security definer set search_path to 'public' as $$
declare
  v_org uuid := my_org_id(); cat jsonb; price int; p_leg numeric; p_epi numeric; guarantee text; v_role volunteer_role;
  owned uuid[]; picked uuid[] := '{}'; i int; r numeric; rar rarity; vol volunteers; best int := 0; missing int := 0;
  hq uuid;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select x into cat from jsonb_array_elements(pack_catalog()) x where x->>'kind' = p_kind;
  if cat is null then raise exception 'BAD_PACK'; end if;
  price := (cat->>'price')::int; p_leg := (cat->>'leg')::numeric; p_epi := (cat->>'epi')::numeric; guarantee := cat->>'guarantee';
  v_role := (cat->>'role')::volunteer_role;   -- null = qualsiasi ruolo

  select coalesce(array_agg(volunteer_id), '{}') into owned
    from card_inventory where org_id = v_org and state <> 'scaduta';

  if guarantee = 'leggendaria' and not exists (select 1 from volunteers where rarity = 'leggendaria' and is_pack_eligible and id <> all(owned)) then
    raise exception 'NO_LEGENDARY_LEFT'; end if;
  if guarantee = 'epica' and not exists (select 1 from volunteers where rarity in ('epica','leggendaria') and is_pack_eligible and id <> all(owned)) then
    raise exception 'NO_EPIC_LEFT'; end if;
  if v_role is not null and not exists (select 1 from volunteers where role = v_role and is_pack_eligible and id <> all(owned)) then
    raise exception 'NO_ROLE_LEFT'; end if;

  perform 1 from organizations where id = v_org for update;
  perform set_config('app.money_reason', 'Pacchetto volontari', true);
  update organizations set funds = funds - price where id = v_org and funds >= price;
  if not found then raise exception 'INSUFFICIENT_FUNDS'; end if;
  select id into hq from bases where org_id = v_org and is_headquarters;

  for i in 1..5 loop
    r := random();
    rar := case when r < p_leg then 'leggendaria' when r < p_leg + p_epi then 'epica' else 'comune' end;
    if i = 5 and guarantee = 'leggendaria' and best < 2 then rar := 'leggendaria'; end if;
    if i = 5 and guarantee = 'epica' and best < 1 and rar = 'comune' then rar := 'epica'; end if;

    vol := null;
    select * into vol from volunteers where rarity = rar and is_pack_eligible and id <> all(owned) and id <> all(picked)
       and (v_role is null or role = v_role) order by random() limit 1;
    if vol.id is null and rar = 'leggendaria' then
      select * into vol from volunteers where rarity = 'epica' and is_pack_eligible and id <> all(owned) and id <> all(picked)
         and (v_role is null or role = v_role) order by random() limit 1;
    end if;
    if vol.id is null and guarantee = 'epica' and i = 5 and best < 1 then
      select * into vol from volunteers where rarity = 'leggendaria' and is_pack_eligible and id <> all(owned) and id <> all(picked)
         and (v_role is null or role = v_role) order by random() limit 1;
    end if;
    if vol.id is null then
      select * into vol from volunteers where rarity = 'comune' and is_pack_eligible and id <> all(owned) and id <> all(picked)
         and (v_role is null or role = v_role) order by random() limit 1;
    end if;
    if vol.id is null and v_role is not null then   -- specialisti: se finiscono i comuni, va bene qualsiasi rarita' del ruolo
      select * into vol from volunteers where is_pack_eligible and id <> all(owned) and id <> all(picked)
         and role = v_role order by random() limit 1;
    end if;
    if vol.id is null then missing := missing + 1; continue; end if;

    picked := picked || vol.id;
    best := greatest(best, case vol.rarity when 'leggendaria' then 2 when 'epica' then 1 else 0 end);
    return query
      insert into card_inventory (org_id, volunteer_id, base_id) values (v_org, vol.id, hq) returning *;
  end loop;

  if missing > 0 then
    perform set_config('app.money_reason', 'Rimborso pacchetto', true);
    update organizations set funds = funds + (price / 5) * missing where id = v_org;
  end if;
  perform set_config('app.money_reason', '', true);
end $$;

create or replace function public.pack_role_availability()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (
    select v.role::text role, count(*) n from volunteers v
     where v.is_pack_eligible
       and v.id not in (select volunteer_id from card_inventory where org_id = my_org_id() and state <> 'scaduta')
     group by v.role) x
$$;
grant execute on function public.pack_role_availability() to authenticated;
