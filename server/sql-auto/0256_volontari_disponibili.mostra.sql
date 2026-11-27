\pset pager off
-- quanti volontari ci sono per ruolo e quanti ne possiede al massimo una sola associazione (solo numeri)
select v.role::text ruolo, count(*) filter (where v.is_pack_eligible) nel_mazzo,
       count(*) filter (where v.is_pack_eligible and v.rarity = 'comune') comuni,
       count(*) filter (where v.is_pack_eligible and v.rarity = 'epica') epiche,
       count(*) filter (where v.is_pack_eligible and v.rarity = 'leggendaria') leggendarie,
       (select max(c) from (select count(*) c from card_inventory ci join volunteers v2 on v2.id = ci.volunteer_id
          where ci.state <> 'scaduta' and v2.role = v.role and v2.is_pack_eligible group by ci.org_id) z) max_di_una_assoc,
       (select round(avg(c)) from (select count(*) c from card_inventory ci join volunteers v2 on v2.id = ci.volunteer_id
          where ci.state <> 'scaduta' and v2.role = v.role and v2.is_pack_eligible group by ci.org_id) z) media_assoc
  from volunteers v group by v.role order by 1;
select 'assoc con meno di 20 carte libere in totale', count(*) from (
  select o.id, (select count(*) from volunteers v where v.is_pack_eligible) - (select count(*) from card_inventory ci join volunteers v on v.id = ci.volunteer_id
     where ci.org_id = o.id and ci.state <> 'scaduta' and v.is_pack_eligible) liberi
  from organizations o) x where liberi < 20;
select 'liberi per le 5 assoc più grandi', array_agg(liberi order by liberi) from (
  select (select count(*) from volunteers v where v.is_pack_eligible) - count(*) liberi
    from card_inventory ci join volunteers v on v.id = ci.volunteer_id where ci.state <> 'scaduta' and v.is_pack_eligible
   group by ci.org_id order by count(*) desc limit 5) x;
