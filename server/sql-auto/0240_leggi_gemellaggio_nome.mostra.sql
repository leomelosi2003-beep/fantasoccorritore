\pset pager off
select 'TR', i, l from regexp_split_to_table(replace(pg_get_functiondef('twin_rename_base'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'TU', i, l from regexp_split_to_table(replace(pg_get_functiondef('twin_unshare_base'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'B', b.name, o.name, (select name from organizations where id = b.collab_org) from bases b join organizations o on o.id = b.org_id where b.collab_org is not null or b.name like '%🤝%';
select 'COL', column_name from information_schema.columns where table_name = 'bases' and column_name ilike '%name%';
