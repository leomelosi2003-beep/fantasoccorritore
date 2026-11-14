select 'UPG', pg_get_functiondef('public.upgrade_base'::regproc);
select 'MOVE', pg_get_functiondef('public.move_vehicle'::regproc);
select 'PERK', pg_get_functiondef('public.buy_base_perk'::regproc);
select 'COLOR', pg_get_functiondef('public.set_base_color'::regproc);
select 'UNSH', pg_get_functiondef('public.twin_unshare_base'::regproc);
select 'END', pg_get_functiondef('public.end_twinning'::regproc);
select 'CANUSE', pg_get_functiondef('public.can_use_vehicle'::regproc);
select 'POL', polname, pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.bases'::regclass;
