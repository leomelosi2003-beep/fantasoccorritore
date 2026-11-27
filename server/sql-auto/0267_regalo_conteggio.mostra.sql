\pset pager off
with g as (select v.* from vehicles v where v.call_sign like 'Ducato regalo%'
            and exists (select 1 from vehicles x where x.org_id = v.org_id and x.call_sign not like 'Ducato regalo%' and x.created_at < v.created_at))
select 'regali da togliere', count(*),
       count(*) filter (where status = 'disponibile') fermi,
       count(*) filter (where status <> 'disponibile') occupati,
       count(*) filter (where exists (select 1 from mission_assignments a where a.vehicle_id = g.id)) con_servizi
  from g;
select 'my_fleet filtra fuori servizio', position('fuori_servizio' in pg_get_viewdef('my_fleet'::regclass)) > 0;
select 'volontari regalo in servizio', count(*) from card_inventory ci where ci.acquired_at > now() - interval '2 hours' and ci.state <> 'disponibile';
select column_name from information_schema.columns where table_name = 'card_inventory' order by ordinal_position;
