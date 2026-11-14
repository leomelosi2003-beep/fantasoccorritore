select 'CAT', kind, count(*), min(level), max(level) from base_perk_catalog group by kind;
select 'PERKS', p.kind, p.level, b.name from base_perks p join bases b on b.id = p.base_id where b.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
select 'BASES', b.name, b.level, b.vehicle_capacity, b.color from bases b where b.org_id = 'fa0f81c2-fea9-449a-a66f-f84325fe1d06';
select 'FN', p.oid::regprocedure from pg_proc p where proname in ('buy_base_perk','upgrade_base','base_perk_level','set_base_color');
select 'DEF', pg_get_functiondef('public.buy_base_perk'::regproc);
