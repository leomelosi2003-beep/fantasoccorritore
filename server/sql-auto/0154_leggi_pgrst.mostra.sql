\pset pager off
select 'ET', evtname, evtevent, evtfoid::regproc, evtenabled from pg_event_trigger;
select 'FN', p.oid::regprocedure, i, l from pg_proc p, regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') with ordinality x(l,i)
 where p.proname in ('pgrst_ddl_watch','pgrst_drop_watch');
