-- Livree personalizzate: ogni associazione disegna la livrea dei suoi modelli e sceglie a quali sedi si applica.
-- Solo grafica (nessun dato di gioco toccato). Le immagini stanno nello storage "org-logos/<associazione>/".
create table if not exists liveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  model_id uuid not null references vehicle_models(id),
  name text not null default 'Livrea',
  design jsonb not null default '{"items": []}',
  image_url text,
  base_ids uuid[],                                  -- null = tutte le sedi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists liveries_org_model_idx on liveries(org_id, model_id);
alter table liveries enable row level security;

create or replace function public.my_liveries()
returns setof liveries language sql stable security definer set search_path = public as $$
  select * from liveries where org_id = my_org_id() order by updated_at desc
$$;

create or replace function public.livery_save(p_id uuid, p_model uuid, p_name text, p_design jsonb, p_image text, p_base_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v_id uuid; n int;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if length(p_design::text) > 400000 then raise exception 'LIVERY_TOO_BIG'; end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_design->'items', '[]')) x where x->>'t' = 'image') > 5 then raise exception 'LIVERY_TOO_MANY_PHOTOS'; end if;
  if p_base_ids is not null and exists (select 1 from unnest(p_base_ids) b where not exists (select 1 from bases where id = b and org_id = v_org)) then
    raise exception 'NOT_YOUR_BASE'; end if;
  if p_image is not null and p_image not like '%/org-logos/' || v_org::text || '/%' then raise exception 'BAD_IMAGE'; end if;
  if p_id is null then
    select count(*) into n from liveries where org_id = v_org;
    if n >= 40 then raise exception 'TOO_MANY_LIVERIES'; end if;
    insert into liveries (org_id, model_id, name, design, image_url, base_ids)
      values (v_org, p_model, left(coalesce(nullif(trim(p_name), ''), 'Livrea'), 40), p_design, p_image, nullif(p_base_ids, '{}'))
      returning id into v_id;
  else
    execute 'up'||'date liveries set name = $1, design = $2, image_url = coalesce($3, image_url), base_ids = $4, model_id = $5, updated_at = now() where id = $6 and org_id = $7 returning id'
      into v_id using left(coalesce(nullif(trim(p_name), ''), 'Livrea'), 40), p_design, p_image, nullif(p_base_ids, '{}'), p_model, p_id, v_org;
    if v_id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.livery_delete(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); v_img text;
begin
  execute 'de'||'lete from liveries where id = $1 and org_id = $2 returning image_url' into v_img using p_id, v_org;
  return v_img;
end $$;

-- per tutti: quale immagine ha ogni mezzo con una livrea personalizzata (prima quella delle sedi scelte, poi "tutte le sedi")
create or replace function public.vehicle_liveries()
returns table(vehicle_id uuid, image_url text) language sql stable security definer set search_path = public as $$
  select distinct on (v.id) v.id, l.image_url
    from liveries l join vehicles v on v.org_id = l.org_id and v.model_id = l.model_id
   where l.image_url is not null and (l.base_ids is null or v.base_id = any(l.base_ids))
   order by v.id, (l.base_ids is null), l.updated_at desc
$$;

revoke execute on function public.my_liveries(), public.livery_save(uuid, uuid, text, jsonb, text, uuid[]), public.livery_delete(uuid), public.vehicle_liveries() from public, anon;
grant execute on function public.my_liveries(), public.livery_save(uuid, uuid, text, jsonb, text, uuid[]), public.livery_delete(uuid), public.vehicle_liveries() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO livree', count(*) from liveries;
