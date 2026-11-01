-- VOLONTARI: catalogo iniziale, pacchetto settimanale con ruoli garantiti, vista delle mie carte.
alter table volunteers add column if not exists gender char(1);

insert into volunteers (gender,first_name,last_name,nickname,role,rarity,stat_guida,stat_soccorso,stat_resilienza,pros,cons,trait_mods,source) values
('m','Lorenzo','Salvadori','il Fulmine','autista','comune',50,57,46,ARRAY['Instancabile']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"night_fatigue": 0.3}'::jsonb,'admin'),
('f','Giulia','Tamburini','la Roccia','soccorritore_base','comune',45,51,65,ARRAY['Sangue freddo da vendere']::text[],ARRAY['Fame perenne: si ferma al panificio']::text[],'{"rosso_fatigue": -0.15}'::jsonb,'admin'),
('m','Stefano','Mazzoni','Sirena','soccorritore_base','comune',56,53,56,ARRAY['Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"night_fatigue": 0.3}'::jsonb,'admin'),
('m','Pietro','Mazzoni','il Prof','autista','comune',72,63,63,ARRAY['Sorriso che calma tutti']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{}'::jsonb,'admin'),
('m','Andrea','Tamburini','Tachicardia','soccorritore_avanzato','comune',57,73,36,ARRAY['Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Fame perenne: si ferma al panificio']::text[],'{}'::jsonb,'admin'),
('m','Pietro','Ghelardini','il Muto','caposervizio','comune',43,47,49,ARRAY['Mani d''oro con le flebo']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{}'::jsonb,'admin'),
('m','Marco','Giannoni','Pacciame','autista','comune',62,37,49,ARRAY['Freddezza nei codici rossi']::text[],ARRAY['Chiacchierone in ambulanza']::text[],'{"rosso_fatigue": -0.2}'::jsonb,'admin'),
('m','Tommaso','Vannucci','la Bussola','soccorritore_base','comune',42,60,62,ARRAY['Mani d''oro con le flebo']::text[],ARRAY['Chiacchierone in ambulanza']::text[],'{}'::jsonb,'admin'),
('f','Irene','Rossetti','Ciccio','soccorritore_base','comune',34,37,65,ARRAY['Instancabile']::text[],ARRAY['Brontolone']::text[],'{}'::jsonb,'admin'),
('f','Alice','Ulivieri','il Barone','autista','comune',75,38,65,ARRAY['Conosce ogni vicolo di Livorno']::text[],ARRAY['Di notte crolla']::text[],'{"night_fatigue": 0.2}'::jsonb,'admin'),
('m','Stefano','Pardini','Spinale','soccorritore_avanzato','comune',36,65,59,ARRAY['Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{}'::jsonb,'admin'),
('f','Benedetta','Tognetti','Turbo','caposervizio','comune',60,59,39,ARRAY['Sorriso che calma tutti']::text[],ARRAY['Si agita sui codici rossi']::text[],'{"rosso_fatigue": 0.2}'::jsonb,'admin'),
('m','Tommaso','Mazzoni','la Zia','autista','comune',50,39,61,ARRAY['Freddezza nei codici rossi']::text[],ARRAY['Chiacchierone in ambulanza']::text[],'{"rosso_fatigue": -0.2}'::jsonb,'admin'),
('m','Lorenzo','Cecchi','Dottorino','soccorritore_base','comune',60,58,49,ARRAY['Mani d''oro con le flebo']::text[],ARRAY['Canta in sirena']::text[],'{}'::jsonb,'admin'),
('m','Federico','Carmignani','il Gufo','soccorritore_base','comune',41,45,45,ARRAY['Conosce ogni vicolo di Livorno']::text[],ARRAY['Perde sempre le chiavi del mezzo']::text[],'{}'::jsonb,'admin'),
('f','Benedetta','Cecchi','Bombola','autista','comune',54,35,53,ARRAY['Instancabile']::text[],ARRAY['Canta in sirena']::text[],'{}'::jsonb,'admin'),
('f','Arianna','Cecchi','Saetta','soccorritore_avanzato','comune',39,45,63,ARRAY['Sempre puntuale al cambio turno']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"night_fatigue": 0.3}'::jsonb,'admin'),
('f','Benedetta','Niccolai','la Pantera','caposervizio','comune',53,67,61,ARRAY['Sorriso che calma tutti']::text[],ARRAY['Fame perenne: si ferma al panificio']::text[],'{}'::jsonb,'admin'),
('f','Arianna','Del Corso','Cacciucco','autista','comune',70,52,46,ARRAY['Sorriso che calma tutti']::text[],ARRAY['Di notte crolla']::text[],'{"night_fatigue": 0.2}'::jsonb,'admin'),
('m','Pietro','Baldacci','il Moro','soccorritore_base','comune',49,37,62,ARRAY['Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Fame perenne: si ferma al panificio']::text[],'{}'::jsonb,'admin'),
('f','Ilaria','Meucci','Labronico','soccorritore_base','comune',49,51,47,ARRAY['Freddezza nei codici rossi']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"rosso_fatigue": -0.2, "night_fatigue": 0.3}'::jsonb,'admin'),
('f','Camilla','Carmignani','la Tigre','autista','comune',72,47,53,ARRAY['Nottambulo: di notte rende il doppio']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{"night_fatigue": -0.25}'::jsonb,'admin'),
('f','Benedetta','Pieraccini','Puntura','soccorritore_avanzato','comune',30,61,58,ARRAY['Nottambulo: di notte rende il doppio']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{"night_fatigue": -0.25}'::jsonb,'admin'),
('f','Beatrice','Ulivieri','il Vichingo','caposervizio','comune',30,46,55,ARRAY['Nottambulo: di notte rende il doppio']::text[],ARRAY['Canta in sirena']::text[],'{"night_fatigue": -0.25}'::jsonb,'admin'),
('f','Giulia','Mazzoni','Scoop','autista','comune',73,64,60,ARRAY['Sangue freddo da vendere']::text[],ARRAY['Canta in sirena']::text[],'{"rosso_fatigue": -0.15}'::jsonb,'admin'),
('m','Giacomo','Del Corso','Sbirulino','soccorritore_base','comune',46,56,59,ARRAY['Sempre puntuale al cambio turno']::text[],ARRAY['Si agita sui codici rossi']::text[],'{"rosso_fatigue": 0.2}'::jsonb,'admin'),
('f','Lucia','Salvadori','il Capitano','soccorritore_avanzato','epica',55,90,61,ARRAY['Instancabile','Sorriso che calma tutti']::text[],ARRAY['Chiacchierone in ambulanza']::text[],'{}'::jsonb,'admin'),
('m','Giacomo','Mazzoni','la Volpe','caposervizio','epica',76,90,65,ARRAY['Guida fluida, il paziente non se ne accorge','Sempre puntuale al cambio turno']::text[],ARRAY['Di notte crolla']::text[],'{"night_fatigue": 0.2}'::jsonb,'admin'),
('m','Tommaso','Paoli','Ventimiglia','autista','epica',93,77,76,ARRAY['Nottambulo: di notte rende il doppio','Freddezza nei codici rossi']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"night_fatigue": 0.05, "rosso_fatigue": -0.2}'::jsonb,'admin'),
('m','Andrea','Tognetti','Ossigeno','soccorritore_base','epica',62,77,64,ARRAY['Mani d''oro con le flebo','Sorriso che calma tutti']::text[],ARRAY['Brontolone']::text[],'{}'::jsonb,'admin'),
('m','Gabriele','Orsini','il Mago','soccorritore_avanzato','epica',74,85,65,ARRAY['Sorriso che calma tutti','Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Lento a svegliarsi di notte']::text[],'{"night_fatigue": 0.3}'::jsonb,'admin'),
('f','Martina','Fantozzi','Beccafico','caposervizio','epica',64,81,64,ARRAY['Sempre puntuale al cambio turno','Guida fluida, il paziente non se ne accorge']::text[],ARRAY['Canta in sirena']::text[],'{}'::jsonb,'admin'),
('m','Duccio','Fantozzi','la Lince','autista','epica',75,69,74,ARRAY['Instancabile','Ha fatto il corso BLSD 12 volte']::text[],ARRAY['Brontolone']::text[],'{}'::jsonb,'admin'),
('f','Ilaria','Nardini','Tecnico','soccorritore_base','epica',62,68,72,ARRAY['Nottambulo: di notte rende il doppio','Guida fluida, il paziente non se ne accorge']::text[],ARRAY['Fame perenne: si ferma al panificio']::text[],'{"night_fatigue": -0.25}'::jsonb,'admin'),
('m','Riccardo','Ulivieri','Ponce','soccorritore_avanzato','epica',72,89,77,ARRAY['Guida fluida, il paziente non se ne accorge','Instancabile']::text[],ARRAY['Sempre in ritardo al cambio turno']::text[],'{}'::jsonb,'admin'),
('f','Martina','Pieraccini','Zampa','caposervizio','epica',57,82,72,ARRAY['Freddezza nei codici rossi','Guida fluida, il paziente non se ne accorge']::text[],ARRAY['Soffre il mal d''auto dietro']::text[],'{"rosso_fatigue": -0.2}'::jsonb,'admin'),
('m','Riccardo','Lazzerini','il Saggio','autista','leggendaria',97,94,83,ARRAY['Conosce ogni vicolo di Livorno','Sempre puntuale al cambio turno']::text[],'{}'::text[],'{}'::jsonb,'admin'),
('m','Luca','Ghelardini','la Furia','soccorritore_base','leggendaria',84,82,85,ARRAY['Nottambulo: di notte rende il doppio','Sorriso che calma tutti']::text[],'{}'::text[],'{"night_fatigue": -0.25}'::jsonb,'admin'),
('f','Lucia','Del Corso','Pinolo','soccorritore_avanzato','leggendaria',84,99,84,ARRAY['Sangue freddo da vendere','Nottambulo: di notte rende il doppio']::text[],'{}'::text[],'{"rosso_fatigue": -0.15, "night_fatigue": -0.25}'::jsonb,'admin'),
('m','Alessio','Franceschi','il Notturno','caposervizio','leggendaria',83,95,94,ARRAY['Guida fluida, il paziente non se ne accorge','Sorriso che calma tutti']::text[],'{}'::text[],'{}'::jsonb,'admin');

-- Pacchetto settimanale: 5 carte. Le prime due sono sempre un autista e un soccorritore,
-- così si può subito formare un equipaggio. Rarità: 80% comune, 17% epica, 3% leggendaria;
-- leggendaria garantita all'ottavo pacchetto senza leggendarie.
create or replace function open_weekly_pack() returns setof card_inventory
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org uuid := my_org_id(); o organizations; p weekly_packs;
  r numeric; rar rarity; got_legendary boolean := false; vol volunteers; i int; days int;
  forced volunteer_role;
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

  for i in 1..5 loop
    r := random();
    rar := case when r < 0.03 then 'leggendaria' when r < 0.20 then 'epica' else 'comune' end;
    if i = 5 and not got_legendary and o.packs_since_legendary >= 7 then rar := 'leggendaria'; end if;
    forced := case i when 1 then 'autista'::volunteer_role when 2 then 'soccorritore_base'::volunteer_role end;

    select * into vol from volunteers
     where rarity = rar and is_pack_eligible and (forced is null or role = forced)
     order by random() limit 1;
    if not found then
      select * into vol from volunteers
       where is_pack_eligible and (forced is null or role = forced)
       order by random() limit 1;
      rar := vol.rarity;
    end if;
    if rar = 'leggendaria' then got_legendary := true; end if;
    days := coalesce(vol.contract_days, case rar when 'comune' then 7 when 'epica' then 21 else 42 end);

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

-- Le mie carte con energia calcolata in tempo reale
create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, v.role, v.rarity, v.gender, v.avatar_url,
       v.stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id();
grant select on my_cards to authenticated;

-- Il pacchetto di questa settimana è già stato aperto?
create or replace function pack_status() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'opened', exists (select 1 from weekly_packs where org_id = my_org_id()
                      and week_start = date_trunc('week', now() at time zone 'Europe/Rome')::date),
    'next_pack_at', (date_trunc('week', now() at time zone 'Europe/Rome') + interval '7 days') at time zone 'Europe/Rome')
$$;
grant execute on function pack_status() to authenticated;
