\pset pager off
select 'DEF', pg_get_functiondef('drive_seconds'::regproc);
select 'MOD', name, vmax_kmh, agility, coalesce(to_jsonb(m)->>'base_cost','') from vehicle_models m order by agility desc, vmax_kmh desc;
