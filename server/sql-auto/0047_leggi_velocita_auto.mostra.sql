with f as (select replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n') s)
select 'CLAIM', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where l ~* 'drive_seconds|v_mode|speed|boost|rientro|returning|in_servizio|disponibile|v_from|v_pos' order by n;
select 'DRIVE', pg_get_functiondef('public.drive_seconds'::regproc);
with f as (select replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n') s)
select 'AUTO', n, l from f, regexp_split_to_table(f.s, E'\n') with ordinality t(l, n) where n between 1 and 120 order by n;
select 'PC', left(title, 90), created_at from missions where venue = 'PC' order by created_at desc limit 3;
