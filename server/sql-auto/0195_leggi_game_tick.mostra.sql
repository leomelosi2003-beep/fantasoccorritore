\pset pager off
select 'TS', to_jsonb(t) from tick_state t limit 3;
select 'GT', i, l from regexp_split_to_table(replace(pg_get_functiondef('game_tick'::regproc), E'\r\n', E'\n'), E'\n') with ordinality x(l,i) where l ~* 'dispatch|medical|interval|due|cadenc|when';
