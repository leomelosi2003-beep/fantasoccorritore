select 'FN', p.oid::regprocedure::text, pg_get_functiondef(p.oid) from pg_proc p where p.proname in ('sea_path','sea_route_points','hospital_gates') and p.pronamespace = 'public'::regnamespace;
