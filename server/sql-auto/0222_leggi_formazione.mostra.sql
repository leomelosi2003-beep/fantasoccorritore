\pset pager off
select 'FN', p.proname, pg_get_function_identity_arguments(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname ~* 'train|corso|formaz|upgrade_card|promot');
select 'TR', i, l from pg_proc p, regexp_split_to_table(replace(pg_get_functiondef(p.oid), E'\r\n', E'\n'), E'\n') with ordinality x(l,i)
 where p.pronamespace='public'::regnamespace and p.proname ~* '^(train_card|start_training|card_train|train_volunteer)';
select 'ST', state, count(*) from card_inventory group by 2;
