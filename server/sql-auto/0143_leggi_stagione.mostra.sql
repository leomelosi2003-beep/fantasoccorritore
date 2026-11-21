\pset pager off
select 'CS', i, l from regexp_split_to_table(replace(pg_get_functiondef('close_season'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'SB', pg_get_function_identity_arguments('season_board'::regproc), pg_get_function_result('season_board'::regproc);
select 'BV', i, l from regexp_split_to_table(replace(pg_get_functiondef('buy_vehicle'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'JOB', jobname, schedule, command from cron.job where jobname ilike '%season%' or command ilike '%season%';
select 'MOD', name, moto, ordinaria, automedica, transfer_only, dual_use, base_cost from vehicle_models where not coalesce(boat,false) and not coalesce(aib,false) and not coalesce(maxi,false) order by base_cost desc limit 40;
select 'EQ', code, slot, cost, provides from equipment order by slot, code;
