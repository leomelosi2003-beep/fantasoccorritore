\pset pager off
\set cvl '''fa0f81c2-fea9-449a-a66f-f84325fe1d06'''
select 'BOARD', name, wealth, growth_pct, earnings_7d, services_7d from leaderboard_v2() order by growth_pct desc nulls last limit 12;
select 'RICCHI', name, wealth, growth_pct, earnings_7d from leaderboard_v2() order by wealth desc nulls last limit 6;
select 'SNAP', day, value from org_snapshots where org_id = :cvl and day > current_date - 9 order by day;
select 'DEF', substring(pg_get_functiondef('leaderboard_v2'::regproc) from 1 for 3500);
select 'LEDGER', left(regexp_replace(reason, '[0-9]+', '#', 'g'), 45) r, sum(amount), count(*) from org_ledger
  where org_id = :cvl and created_at > now() - interval '7 days' group by 2 order by abs(sum(amount)) desc limit 35;
select 'ORG', funds, reputation, auto_reserve, auto_codes, cardinality(auto_base_ids) from organizations where id = :cvl;
select 'FLOTTA', v.status, count(*) from vehicles v where v.org_id = :cvl group by 2;
select 'SEDE', b.name, b.level, (select count(*) from vehicles v where v.base_id = b.id) mezzi,
  count(a.id) servizi48, coalesce(sum(a.reward_funds),0) incasso48,
  round(coalesce(sum(a.reward_funds),0)::numeric / greatest(1,(select count(*) from vehicles v where v.base_id = b.id))) per_mezzo,
  (select count(distinct b2.org_id) from bases b2 where b2.org_id <> b.org_id and st_dwithin(b2.location, b.location, 20000)) rivali20km
  from bases b left join mission_assignments a on a.base_id = b.id and a.assigned_at > now() - interval '48 hours'
  where b.org_id = :cvl group by b.id order by incasso48 desc;
with m as (
  select a.org_id, a.reward_funds, round(st_y(mi.location::geometry)::numeric,1) lat, round(st_x(mi.location::geometry)::numeric,1) lng
  from mission_assignments a join missions mi on mi.id = a.mission_id where a.assigned_at > now() - interval '48 hours')
select 'ZONA', lat, lng, count(*) tot, count(*) filter (where org_id = :cvl) cvl, coalesce(sum(reward_funds),0) incasso,
  coalesce(sum(reward_funds) filter (where org_id = :cvl),0) incasso_cvl, count(distinct org_id) assoc,
  (select string_agg(b.name, ', ') from bases b where b.org_id = :cvl and st_dwithin(b.location, st_setsrid(st_makepoint(lng,lat),4326)::geography, 12000)) sedi_cvl
from m group by lat, lng order by incasso desc limit 30;
select 'MISS', category, code, count(*), count(*) filter (where slots_taken = 0) mai_presi from missions
  where created_at > now() - interval '24 hours' group by 2,3 order by 4 desc;
