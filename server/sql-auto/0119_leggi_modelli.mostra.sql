\pset pager off
select 'ROW', to_jsonb(m) from vehicle_models m where name in ('V-Craftor', 'B-Sprint', 'B-Marlin', 'M-Sprinterix XL');
select 'CL', i, l from regexp_split_to_table(replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
  where l ~* 'TRANSFER_NEEDS_LONG|transfer_only|long_emergency|BOAT_CREW|v_boat :=|ORDINARIA_ONLY|TRANSFER_ONLY|LONG_';
select 'AD', i, l from regexp_split_to_table(replace(pg_get_functiondef('auto_dispatch_org'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
  where l ~* 'transfer_only|long_emergency|trasferimento';
select 'SEA', p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f' and pg_get_functiondef(p.oid) ~* 'boat_speed|speed_kn|knots';
