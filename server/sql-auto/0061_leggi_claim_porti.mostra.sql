select 'CLAIM', n, l from (select row_number() over () n, l from regexp_split_to_table(replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') l) x where n between 1 and 330;
select 'ISLAND', pg_get_functiondef('public.island_of(geography)'::regprocedure);
select 'PORTS', column_name, data_type from information_schema.columns where table_name = 'ports' order by ordinal_position;
select 'PORT', name, island, can_unload, round(st_y(location::geometry)::numeric, 4), round(st_x(location::geometry)::numeric, 4) from ports order by name;
