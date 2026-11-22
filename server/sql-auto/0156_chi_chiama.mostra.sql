\pset pager off
create temp table _c as select queryid, calls from pg_stat_statements;
select pg_sleep(60);
select 'DELTA', s.calls - c.calls delta, round(s.mean_exec_time::numeric) ms, substring(regexp_replace(s.query, '\s+', ' ', 'g') from '"public"\."[a-z_0-9]+"') fn
  from pg_stat_statements s join _c c using (queryid) where s.calls - c.calls > 20 order by 2 desc limit 15;
select 'LED', o.name, l.reason, count(*), sum(l.amount) from org_ledger l join organizations o on o.id = l.org_id
 where l.created_at > now() - interval '15 minutes' group by 2,3 order by 4 desc limit 10;
