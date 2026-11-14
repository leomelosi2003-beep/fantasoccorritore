-- lettura (solo codice delle funzioni, nessun dato personale)
select 'COLS', string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_name='vehicle_models' and table_schema='public';
select 'EQ', code, slot, cost, provides, effects from equipment order by slot, sort;
select 'BUY', pg_get_functiondef('public.buy_vehicle'::regproc);
select 'MOUNT', pg_get_functiondef('public.equip_mount'::regproc);
select 'EQV', pg_get_functiondef('public._equip_vehicle'::regproc);
with f as (select replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n') s)
select 'CLAIM', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n)
 where l ~* 'aib|maxi|event_id|grande_evento|v_model|vm\.|ordinari|transfer_only|v_boat :=|declare|AIB_ONLY|FIRE_NEEDS' order by n;
with f as (select replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n') s)
select 'CDA', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n)
 where l ~* 'reward_mult|equipment|maxi|least\(3|base_reward_bonus|v_reward :=|reward :=|effects' order by n;
select 'FLEET', pg_get_viewdef('public.my_fleet'::regclass, true) ~ 'aib';
with f as (select replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n') s)
select 'AUTO', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where l ~* 'aib|grande_evento|boat' order by n;
