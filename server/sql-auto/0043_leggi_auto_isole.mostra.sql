with f as (select replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n') s)
select 'AUTO', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where l ~* 'claim|exception|st_dwithin|when others' order by n;
with f as (select replace(pg_get_functiondef('public.auto_medical'::regproc), E'\r\n', E'\n') s)
select 'MED', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where l ~* 'claim|exception|st_dwithin|when others' order by n;
select 'ELBA', b.name, o.name from bases b join organizations o on o.id = b.org_id
 where st_x(b.location::geometry) between 10.0 and 10.6 and st_y(b.location::geometry) between 42.6 and 43.0;
