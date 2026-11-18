select 'L', n, l from (select row_number() over () n, l from regexp_split_to_table(replace(pg_get_functiondef('public.spread_wildfires()'::regprocedure), E'\r\n', E'\n'), E'\n') l) x
where l ilike '%completes_at%' or l ilike '%Rientro%' or l ilike '%route =%';
