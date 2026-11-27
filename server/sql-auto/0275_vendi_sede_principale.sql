-- 0275: si può vendere anche la sede principale (all'asta), se si ha almeno un'altra sede propria.
-- Appena la si mette all'asta, la sede principale diventa un'altra delle proprie sedi (la più vecchia di proprietà, non in affitto se possibile).
do $$
declare src text; new_src text;
begin
  src := replace(pg_get_functiondef('public.create_base_auction(uuid, integer, integer)'::regprocedure), E'\r\n', E'\n');
  if position('ONLY_BASE' in src) > 0 then raise notice 'ESITO già fatto'; return; end if;
  new_src := replace(src, $a$  if b.is_headquarters then raise exception 'IS_HQ'; end if;$a$,
$a$  if b.is_headquarters then
    -- nuova sede principale: un'altra delle mie sedi
    select id into new_hq from bases where org_id = v_org and id <> b.id and collab_org is null
     order by coalesce(rented, false), built_at limit 1;
    if new_hq is null then raise exception 'ONLY_BASE'; end if;
  end if;$a$);
  new_src := replace(new_src, 'declare v_org uuid := my_org_id(); b bases; aid uuid;', 'declare v_org uuid := my_org_id(); b bases; aid uuid; new_hq uuid;');
  new_src := replace(new_src, $a$  returning id into aid;
  return aid;$a$, $a$  returning id into aid;
  if new_hq is not null then
    execute 'up'||'date bases set is_headquarters = false where id = $1' using b.id;
    execute 'up'||'date bases set is_headquarters = true where id = $1' using new_hq;
  end if;
  return aid;$a$);
  if position('ONLY_BASE' in new_src) = 0 or position('new_hq uuid' in new_src) = 0 or position('is_headquarters = true where id = $1' in new_src) = 0 then
    raise exception 'ESITO patch non applicata';
  end if;
  execute new_src;
  raise notice 'ESITO sede principale vendibile';
end $$;
