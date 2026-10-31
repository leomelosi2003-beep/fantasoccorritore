-- Il primo mezzo di ogni associazione arriva con il kit base gratis:
-- DAE, barella standard, borsoni emergenza e tavola spinale. Gli upgrade si pagano.
alter table equipment add column if not exists starter boolean not null default false;
update equipment set starter = code in ('dae','barella_std','borsoni','spinale');

do $do$
declare src text;
begin
  src := pg_get_functiondef('buy_vehicle(uuid,uuid,uuid,text,text[])'::regprocedure);
  if position('first_vehicle' in src) = 0 then
    src := replace(src, 'n_dup int; v vehicles;', 'n_dup int; v vehicles; first_vehicle boolean;');
    src := replace(src,
      'if exists (select 1 from unnest(coalesce(p_equipment',
      'first_vehicle := not exists (select 1 from vehicles where org_id = v_org);
  if first_vehicle then
    select coalesce(p_equipment, ''{}'') || coalesce(array_agg(e.code), ''{}'') into p_equipment
      from equipment e
     where e.starter and e.slot not in (select slot from equipment where code = any(coalesce(p_equipment, ''{}'')));
  end if;
  if exists (select 1 from unnest(coalesce(p_equipment');
    src := replace(src,
      'coalesce(sum(cost), 0)',
      'coalesce(sum(case when first_vehicle and starter then 0 else cost end), 0)');
    execute src;
  end if;
end $do$;
