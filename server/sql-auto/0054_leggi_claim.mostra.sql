-- lettura: righe di claim_mission_as che controllano requires / presidi
select n, l from (select row_number() over () n, l from regexp_split_to_table(replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') l) x
where l ilike '%requires%' or l ilike '%provides%' or l ilike '%EQUIP%' or l ilike '%grande_evento%' or l ilike '%MAXI%' or l ilike '%PC_%';
