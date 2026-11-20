-- Livree: si possono applicare a tutti i mezzi del modello, ad alcune sedi o ad alcuni mezzi.
-- Solo modelli che l'associazione possiede. Chi è in un'alleanza deve avere il logo dell'alleanza sulla livrea.
alter table liveries add column if not exists vehicle_ids uuid[];

create or replace function public.livery_save2(p_id uuid, p_model uuid, p_name text, p_design jsonb, p_image text, p_base_ids uuid[], p_vehicle_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v_id uuid; n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if not exists (select 1 from vehicles where org_id = v_org and model_id = p_model) then raise exception 'MODEL_NOT_OWNED'; end if;
  if length(p_design::text) > 400000 then raise exception 'LIVERY_TOO_BIG'; end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_design->'items', '[]')) x where x->>'t' = 'image' and not coalesce((x->>'ally')::boolean, false)) > 5 then
    raise exception 'LIVERY_TOO_MANY_PHOTOS'; end if;
  if exists (select 1 from alliance_members where org_id = v_org)
     and not exists (select 1 from jsonb_array_elements(coalesce(p_design->'items', '[]')) x where coalesce((x->>'ally')::boolean, false)) then
    raise exception 'ALLY_LOGO_REQUIRED'; end if;
  if p_base_ids is not null and exists (select 1 from unnest(p_base_ids) b where not exists (select 1 from bases where id = b and org_id = v_org)) then
    raise exception 'NOT_YOUR_BASE'; end if;
  if p_vehicle_ids is not null and exists (select 1 from unnest(p_vehicle_ids) x where not exists (select 1 from vehicles where id = x and org_id = v_org and model_id = p_model)) then
    raise exception 'NOT_YOUR_VEHICLE'; end if;
  if p_image is not null and p_image not like '%/org-logos/' || v_org::text || '/%' then raise exception 'BAD_IMAGE'; end if;
  p_base_ids := nullif(p_base_ids, '{}'); p_vehicle_ids := nullif(p_vehicle_ids, '{}');
  if p_vehicle_ids is not null then p_base_ids := null; end if;
  if p_id is null then
    select count(*) into n from liveries where org_id = v_org;
    if n >= 40 then raise exception 'TOO_MANY_LIVERIES'; end if;
    insert into liveries (org_id, model_id, name, design, image_url, base_ids, vehicle_ids)
      values (v_org, p_model, left(coalesce(nullif(trim(p_name), ''), 'Livrea'), 40), p_design, p_image, p_base_ids, p_vehicle_ids)
      returning id into v_id;
  else
    execute 'up'||'date liveries set name = $1, design = $2, image_url = coalesce($3, image_url), base_ids = $4, vehicle_ids = $5, model_id = $6, updated_at = now() where id = $7 and org_id = $8 returning id'
      into v_id using left(coalesce(nullif(trim(p_name), ''), 'Livrea'), 40), p_design, p_image, p_base_ids, p_vehicle_ids, p_model, p_id, v_org;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

-- priorità: livrea dei mezzi scelti, poi delle sedi scelte, poi "tutti"
create or replace function public.vehicle_liveries()
returns table(vehicle_id uuid, image_url text) language sql stable security definer set search_path = public as $$
  select distinct on (v.id) v.id, l.image_url
    from liveries l join vehicles v on v.org_id = l.org_id and v.model_id = l.model_id
   where l.image_url is not null
     and (case when l.vehicle_ids is not null then v.id = any(l.vehicle_ids)
               when l.base_ids is not null then v.base_id = any(l.base_ids) else true end)
   order by v.id, (case when l.vehicle_ids is not null then 0 when l.base_ids is not null then 1 else 2 end), l.updated_at desc
$$;
revoke execute on function public.livery_save2(uuid, uuid, text, jsonb, text, uuid[], uuid[]) from public, anon;
grant execute on function public.livery_save2(uuid, uuid, text, jsonb, text, uuid[], uuid[]) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO livree2', count(*) from liveries;
