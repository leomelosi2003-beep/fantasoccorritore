\pset pager off
select 'C', table_name, string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
 where table_schema='public' and table_name in ('events','vehicles','liveries','bases','organizations') group by table_name;
