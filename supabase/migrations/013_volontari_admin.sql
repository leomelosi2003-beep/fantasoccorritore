-- Volontari: i comuni li genera il gioco, epici e leggendari li crea solo l'admin.
-- Niente doppioni: nomi unici nel catalogo e nessuna carta già posseduta nel pacchetto.

delete from volunteers where not exists (select 1 from card_inventory ci where ci.volunteer_id = volunteers.id);

alter table volunteers drop constraint if exists rare_only_by_admin;
alter table volunteers add constraint rare_only_by_admin check (rarity = 'comune' or source = 'admin');
create unique index if not exists volunteers_unique_name on volunteers (lower(first_name), lower(last_name));

insert into volunteers (gender,first_name,last_name,nickname,role,rarity,stat_guida,stat_soccorso,stat_resilienza,pros,cons,trait_mods,source) values
('m','Pietro','Franceschi','Ponce','soccorritore_base','comune',44,65,43,ARRAY['Sangue freddo da vendere'],ARRAY['Brontolone'],'{"rosso_fatigue": -0.15}'::jsonb,'ai'),
('f','Valentina','Giannoni','la Bussola','soccorritore_base','comune',48,40,61,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Chiacchierone in ambulanza'],'{}'::jsonb,'ai'),
('m','Federico','Tognetti','Ciccio','soccorritore_avanzato','comune',49,69,59,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('f','Benedetta','Lenzi','la Roccia','caposervizio','comune',42,67,35,ARRAY['Nottambulo: di notte rende il doppio'],ARRAY['Perde sempre le chiavi del mezzo'],'{"night_fatigue": -0.25}'::jsonb,'ai'),
('m','Marco','Niccolai','Ossigeno','soccorritore_avanzato','comune',34,46,57,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('f','Arianna','Fantozzi','Scintilla','caposervizio','comune',31,73,55,ARRAY['Instancabile'],ARRAY['Canta in sirena'],'{}'::jsonb,'ai'),
('m','Duccio','Pardini','Turbo','autista','comune',67,42,66,ARRAY['Sempre puntuale al cambio turno'],ARRAY['Di notte crolla'],'{"night_fatigue": 0.2}'::jsonb,'ai'),
('f','Elisa','Cappellini','Stellina','soccorritore_base','comune',40,44,48,ARRAY['Sorriso che calma tutti'],ARRAY['Di notte crolla'],'{"night_fatigue": 0.2}'::jsonb,'ai'),
('m','Stefano','Carmignani','il Capitano','soccorritore_base','comune',51,64,49,ARRAY['Nottambulo: di notte rende il doppio'],ARRAY['Brontolone'],'{"night_fatigue": -0.25}'::jsonb,'ai'),
('f','Giulia','Bargagna','la Tigre','autista','comune',72,37,47,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('m','Tommaso','Baldacci','il Mago','soccorritore_base','comune',33,63,47,ARRAY['Sempre puntuale al cambio turno'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('f','Beatrice','Sbrana','la Zia','soccorritore_base','comune',38,48,43,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Chiacchierone in ambulanza'],'{}'::jsonb,'ai'),
('m','Niccolò','Funaioli','il Vichingo','soccorritore_base','comune',54,52,62,ARRAY['Ha fatto il corso BLSD 12 volte'],ARRAY['Perde sempre le chiavi del mezzo'],'{}'::jsonb,'ai'),
('f','Martina','Pieraccini','Sirena','autista','comune',52,59,54,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Fame perenne: si ferma al panificio'],'{}'::jsonb,'ai'),
('m','Luca','Puccinelli','il Gufo','soccorritore_base','comune',41,51,64,ARRAY['Sempre puntuale al cambio turno'],ARRAY['Perde sempre le chiavi del mezzo'],'{}'::jsonb,'ai'),
('f','Margherita','Orsini','la Lince','autista','comune',65,64,46,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('m','Filippo','Zucconi','il Prof','autista','comune',77,63,42,ARRAY['Ha fatto il corso BLSD 12 volte'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('f','Sara','Vannucci','la Maga','soccorritore_base','comune',47,41,48,ARRAY['Mani d''oro con le flebo'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('m','Alessio','Lazzerini','Cacciucco','caposervizio','comune',35,72,56,ARRAY['Sorriso che calma tutti'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('f','Camilla','Nencini','la Volpe','autista','comune',58,36,57,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Fame perenne: si ferma al panificio'],'{}'::jsonb,'ai'),
('m','Gabriele','Ghelardini','il Barone','soccorritore_base','comune',43,42,52,ARRAY['Ha fatto il corso BLSD 12 volte'],ARRAY['Di notte crolla'],'{"night_fatigue": 0.2}'::jsonb,'ai'),
('f','Irene','Pacini','Saetta','soccorritore_base','comune',43,53,52,ARRAY['Ha fatto il corso BLSD 12 volte'],ARRAY['Chiacchierone in ambulanza'],'{}'::jsonb,'ai'),
('m','Michele','Ulivieri','Sbirulino','soccorritore_avanzato','comune',36,59,41,ARRAY['Sorriso che calma tutti'],ARRAY['Chiacchierone in ambulanza'],'{}'::jsonb,'ai'),
('f','Chiara','Mazzoni','la Pantera','caposervizio','comune',36,46,57,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Si agita sui codici rossi'],'{"rosso_fatigue": 0.2}'::jsonb,'ai'),
('m','Iacopo','Cecchi','il Notturno','soccorritore_avanzato','comune',50,60,39,ARRAY['Instancabile'],ARRAY['Fame perenne: si ferma al panificio'],'{}'::jsonb,'ai'),
('f','Alice','Bartolini','Labronica','autista','comune',57,51,51,ARRAY['Sorriso che calma tutti'],ARRAY['Soffre il mal d''auto dietro'],'{}'::jsonb,'ai'),
('m','Simone','Rossetti','il Fulmine','autista','comune',73,35,38,ARRAY['Nottambulo: di notte rende il doppio'],ARRAY['Sempre in ritardo al cambio turno'],'{"night_fatigue": -0.25}'::jsonb,'ai'),
('f','Viola','Nardini','Zampa','autista','comune',48,54,42,ARRAY['Nottambulo: di notte rende il doppio'],ARRAY['Brontolone'],'{"night_fatigue": -0.25}'::jsonb,'ai'),
('m','Matteo','Salvadori','Pinolo','soccorritore_base','comune',52,55,64,ARRAY['Sangue freddo da vendere'],ARRAY['Di notte crolla'],'{"rosso_fatigue": -0.15, "night_fatigue": 0.2}'::jsonb,'ai'),
('f','Silvia','Paoli','Puntura','autista','comune',49,60,55,ARRAY['Sangue freddo da vendere'],ARRAY['Sempre in ritardo al cambio turno'],'{"rosso_fatigue": -0.15}'::jsonb,'ai'),
('m','Lorenzo','Del Corso','Pacciame','caposervizio','comune',59,70,42,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('f','Caterina','Marchetti','la Furia','soccorritore_avanzato','comune',46,67,53,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('m','Paolo','Taddei','il Saggio','soccorritore_avanzato','comune',57,44,53,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Soffre il mal d''auto dietro'],'{}'::jsonb,'ai'),
('f','Francesca','Dell''Omodarme','Tachicardia','soccorritore_avanzato','comune',37,62,61,ARRAY['Guida fluida, il paziente non se ne accorge'],ARRAY['Di notte crolla'],'{"night_fatigue": 0.2}'::jsonb,'ai'),
('m','Riccardo','Tamburini','il Moro','soccorritore_base','comune',31,56,47,ARRAY['Ha fatto il corso BLSD 12 volte'],ARRAY['Lento a svegliarsi di notte'],'{"night_fatigue": 0.3}'::jsonb,'ai'),
('f','Ilaria','Morelli','Beccafico','autista','comune',54,45,42,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Brontolone'],'{}'::jsonb,'ai'),
('m','Andrea','Lemmi','Dottorino','caposervizio','comune',52,62,36,ARRAY['Sorriso che calma tutti'],ARRAY['Di notte crolla'],'{"night_fatigue": 0.2}'::jsonb,'ai'),
('f','Elena','Meucci','la Gazzella','soccorritore_avanzato','comune',38,65,61,ARRAY['Sorriso che calma tutti'],ARRAY['Perde sempre le chiavi del mezzo'],'{}'::jsonb,'ai'),
('m','Giacomo','Gragnani','il Muto','soccorritore_base','comune',45,61,49,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Chiacchierone in ambulanza'],'{}'::jsonb,'ai'),
('f','Lucia','Bonsignori','Bombola','autista','comune',48,60,51,ARRAY['Conosce ogni vicolo di Livorno'],ARRAY['Sempre in ritardo al cambio turno'],'{}'::jsonb,'ai');

-- Pacchetto: niente doppioni (né carte già in squadra né ripetute nello stesso pacchetto).
-- Se esce epica/leggendaria ma l'admin non ne ha ancora create, si ripiega su una comune.
create or replace function open_weekly_pack() returns setof card_inventory
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id(); o organizations; p weekly_packs;
  r numeric; rar rarity; got_legendary boolean := false; vol volunteers; i int; days int;
  forced volunteer_role; picked uuid[] := '{}'; owned uuid[];
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select * into o from organizations where id = v_org for update;
  if exists (select 1 from weekly_packs where org_id = v_org
             and week_start = date_trunc('week', now() at time zone 'Europe/Rome')::date) then
    raise exception 'PACK_ALREADY_OPENED';
  end if;
  insert into weekly_packs (org_id, week_start)
  values (v_org, date_trunc('week', now() at time zone 'Europe/Rome')::date)
  returning * into p;

  select coalesce(array_agg(volunteer_id), '{}') into owned
    from card_inventory where org_id = v_org and state <> 'scaduta';

  for i in 1..5 loop
    r := random();
    rar := case when r < 0.03 then 'leggendaria' when r < 0.20 then 'epica' else 'comune' end;
    if i = 5 and not got_legendary and o.packs_since_legendary >= 7 then rar := 'leggendaria'; end if;
    forced := case i when 1 then 'autista'::volunteer_role when 2 then 'soccorritore_base'::volunteer_role end;

    vol := null;
    -- 1) rarità estratta, senza doppioni
    select * into vol from volunteers
     where rarity = rar and is_pack_eligible and (forced is null or role = forced)
       and id <> all(owned) and id <> all(picked)
     order by random() limit 1;
    -- 2) ripiego su una comune senza doppioni
    if vol.id is null then
      select * into vol from volunteers
       where rarity = 'comune' and is_pack_eligible and (forced is null or role = forced)
         and id <> all(owned) and id <> all(picked)
       order by random() limit 1;
    end if;
    -- 3) catalogo esaurito: si accetta un doppione pur di non dare un pacchetto vuoto
    if vol.id is null then
      select * into vol from volunteers
       where is_pack_eligible and (forced is null or role = forced) and id <> all(picked)
       order by random() limit 1;
    end if;
    if vol.id is null then continue; end if;

    picked := picked || vol.id;
    if vol.rarity = 'leggendaria' then got_legendary := true; end if;
    days := coalesce(vol.contract_days, case vol.rarity when 'comune' then 7 when 'epica' then 21 else 42 end);

    return query
      insert into card_inventory (org_id, volunteer_id, pack_id, base_id, expires_at)
      values (v_org, vol.id, p.id,
              (select id from bases where org_id = v_org and is_headquarters),
              now() + make_interval(days => days))
      returning *;
  end loop;

  update organizations
     set packs_since_legendary = case when got_legendary then 0 else packs_since_legendary + 1 end
   where id = v_org;
end $$;
grant execute on function open_weekly_pack() to authenticated;

-- L'admin può creare e modificare le carte (le policy RLS limitano agli admin)
grant insert, update, delete on volunteers to authenticated;

-- Foto delle carte speciali
insert into storage.buckets (id, name, public) values ('volunteer-photos', 'volunteer-photos', true)
on conflict (id) do nothing;
drop policy if exists "admin upload volunteer photos" on storage.objects;
create policy "admin upload volunteer photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin edit volunteer photos" on storage.objects;
create policy "admin edit volunteer photos" on storage.objects for update to authenticated
  using (bucket_id = 'volunteer-photos' and public.is_admin());
drop policy if exists "admin delete volunteer photos" on storage.objects;
create policy "admin delete volunteer photos" on storage.objects for delete to authenticated
  using (bucket_id = 'volunteer-photos' and public.is_admin());
