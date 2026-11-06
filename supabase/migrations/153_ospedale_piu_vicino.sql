-- Le ambulanze scaricano all'ospedale più vicino con pronto soccorso (o a un centro specializzato giusto per
-- quel paziente, se è ancora più vicino). Prima cardio / trauma maggiore / pediatria andavano solo negli ospedali
-- con quel reparto, anche se lontani. Restano Capraia (eliporto) ed Elba (Portoferraio).
-- Usata da claim_mission, claim_mission_as e call_helicopter. I trasferimenti hanno partenza e arrivo propri.

create or replace function public.nearest_hospital(p_point geography, p_need text)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public', 'extensions'
as $$
  select coalesce(
    -- Capraia: il paziente si consegna all'elisoccorso all'eliporto
    (select id from hospitals where name = 'Eliporto di Capraia'
      and st_y(p_point::geometry) between 43.00 and 43.09 and st_x(p_point::geometry) between 9.78 and 9.87),
    -- Isola d'Elba: si scarica sempre a Portoferraio
    (select id from hospitals where name = 'Ospedale di Portoferraio (Elba)'
      and st_y(p_point::geometry) between 42.70 and 42.90 and st_x(p_point::geometry) between 10.05 and 10.45),
    -- il più vicino con pronto soccorso, o con il reparto giusto per questo paziente
    (select id from hospitals
      where 'ps' = any(capabilities)
         or (p_need is not null and p_need not in ('dimissione', 'ps') and p_need = any(capabilities))
      order by st_distance(location, p_point) limit 1))
$$;
