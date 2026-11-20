\pset pager off
select 'CAP', pg_get_functiondef('fuel_capacity'::regproc);
select 'REF', pg_get_functiondef('refuel_org_vehicles'::regproc);
select 'SPAWN', pg_get_functiondef('spawn_pc_mission'::regproc);
select 'CLAIM', l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l, i)
  where l ~* 'requires|maxi_bonus|venue|''PC''|provides' ;
select 'MOUNT', l from regexp_split_to_table(replace(pg_get_functiondef('equip_mount'::regproc), E'\r\n', E'\n'), E'\n') l where l ~* 'maxi|slot|raise';
select 'BONUS', l from regexp_split_to_table(replace(pg_get_functiondef('complete_due_assignments'::regproc), E'\r\n', E'\n'), E'\n') l where l ~* 'maxi_bonus|requires|PC';
select 'MODELLI', name, coalesce(to_jsonb(m)->>'maxi','?'), to_jsonb(m)->>'kind' from vehicle_models m where name ~* 'maxi|camion|furgon|logist|PC|prot';
