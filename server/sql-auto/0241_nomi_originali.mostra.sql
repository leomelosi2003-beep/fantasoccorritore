\pset pager off
select 'L', b.name, l.reason, l.created_at from bases b join org_ledger l on l.org_id = b.org_id and l.created_at between b.built_at - interval '20 seconds' and b.built_at + interval '20 seconds'
 where b.name like '🤝%' order by b.name;
select 'N', b.name, b.built_at, st_y(b.location::geometry), st_x(b.location::geometry) from bases b where b.name like '🤝%';
