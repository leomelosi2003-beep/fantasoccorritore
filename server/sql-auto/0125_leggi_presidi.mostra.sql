\pset pager off
select 'EQ', code, slot, name, category from equipment where coalesce(category,'') <> 'maxi' order by slot, code;
select 'MOUNT', i, l from regexp_split_to_table(replace(pg_get_functiondef('equip_mount'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i);
select 'MOVE', i, l from regexp_split_to_table(replace(pg_get_functiondef('equip_move'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'raise|maxi|boat|select \* into';
select 'BUY', i, l from regexp_split_to_table(replace(pg_get_functiondef('buy_vehicle'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'equipment|boat|ordinaria|aib';
select 'BARCHE', vm.name, v.equipment, count(*) from vehicles v join vehicle_models vm on vm.id = v.model_id where vm.boat group by 2,3;
