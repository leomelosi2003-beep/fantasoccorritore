\pset pager off
select 'FN', p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('repair_vehicle','service_vehicle','replace_part','mount_tires','repair_body','my_org_id','service_vehicle_do','is_winter','tire_season_now','auto_fix_vehicle');
select 'ORG', pg_get_functiondef('my_org_id'::regproc);
select 'UID', pg_get_functiondef('auth.uid'::regproc);
select 'RV', l from regexp_split_to_table(pg_get_functiondef('repair_vehicle'::regproc), E'\n') l where l ~* 'raise|status|maintenance|my_org';
select 'SV', l from regexp_split_to_table(pg_get_functiondef('service_vehicle'::regproc), E'\n') l where l ~* 'raise|status|maintenance|my_org';
select 'RP', l from regexp_split_to_table(pg_get_functiondef('replace_part'::regproc), E'\n') l where l ~* 'raise|status|maintenance|my_org';
select 'MT', l from regexp_split_to_table(pg_get_functiondef('mount_tires'::regproc), E'\n') l where l ~* 'raise|status|maintenance|my_org|season|stock';
select 'RB', l from regexp_split_to_table(pg_get_functiondef('repair_body'::regproc), E'\n') l where l ~* 'raise|status|maintenance|my_org';
select 'AUTOFIX', p.proname from pg_proc p where pg_get_functiondef(p.oid) ~* 'repair_vehicle|vehicle_issues' and p.prokind='f' and p.pronamespace='public'::regnamespace;
