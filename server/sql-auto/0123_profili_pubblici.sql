-- Profili pubblici delle associazioni: tutti possono vedere sedi, mezzi, volontari, livree e la sede migliore.
-- Banner e presentazione li sceglie il proprietario. Niente soldi in cassa né dati personali.
alter table organizations add column if not exists profile_banner_url text;
alter table organizations add column if not exists profile_bio text;

create or replace function public.set_profile_banner(p_banner text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if p_banner is not null and p_banner not like '%/org-logos/' || v_org::text || '/%' then raise exception 'BAD_IMAGE'; end if;
  execute 'up'||'date organizations set profile_banner_url = $1, profile_bio = $2 where id = $3'
    using p_banner, left(nullif(trim(p_bio), ''), 400), v_org;
end $$;

create or replace function public.orgs_directory()
returns table(id uuid, name text, type text, logo_url text, banner_url text, bio text, reputation numeric, bases int, vehicles int, volunteers int, legends int)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.type::text, o.logo_url, o.profile_banner_url, o.profile_bio, o.reputation::numeric,
         (select count(*) from bases b where b.org_id = o.id)::int,
         (select count(*) from vehicles v where v.org_id = o.id)::int,
         (select count(*) from card_inventory c where c.org_id = o.id and (c.expires_at is null or c.expires_at > now()))::int,
         (select count(*) from card_inventory c join volunteers vo on vo.id = c.volunteer_id
           where c.org_id = o.id and vo.rarity = 'leggendaria' and (c.expires_at is null or c.expires_at > now()))::int
    from organizations o
   order by (select count(*) from vehicles v where v.org_id = o.id) desc
$$;

create or replace function public.org_profile(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (select * from organizations where id = p_org),
  inc as (select a.base_id, sum(a.reward_funds) eur, count(*) n from mission_assignments a
           where a.org_id = p_org and a.assigned_at > now() - interval '7 days' and a.status <> 'annullata' group by a.base_id),
  vb as (select v.base_id, count(*) n from vehicles v where v.org_id = p_org group by v.base_id),
  kinds as (select case when vm.boat then 'barche' when vm.automedica then 'automediche' when vm.moto then 'moto'
                        when vm.aib then 'antincendio' when vm.maxi then 'maxi' when vm.ordinaria or v.converted_ordinaria then 'ordinarie'
                        when vm.transfer_only then 'passi_lunghi' else 'ambulanze' end k, count(*) n
              from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = p_org group by 1),
  models as (select vm.id, vm.name, vm.image_url, count(*) n,
                    (select l.image_url from liveries l where l.org_id = p_org and l.model_id = vm.id and l.image_url is not null
                      order by (l.base_ids is null) desc, l.updated_at desc limit 1) custom
               from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = p_org group by vm.id, vm.name, vm.image_url),
  cards as (select vo.role::text role, vo.rarity::text rarity, vo.first_name, vo.last_name, vo.nickname, vo.avatar_url, c.services_completed
              from card_inventory c join volunteers vo on vo.id = c.volunteer_id
             where c.org_id = p_org and (c.expires_at is null or c.expires_at > now()))
  select jsonb_build_object(
    'id', o.id, 'name', o.name, 'type', o.type, 'logo_url', o.logo_url, 'banner_url', o.profile_banner_url, 'bio', o.profile_bio,
    'reputation', o.reputation, 'created_at', o.created_at,
    'bases', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'hq', b.is_headquarters, 'level', b.level, 'color', b.color,
                         'vehicles', coalesce(vb.n, 0), 'income7', coalesce(inc.eur, 0), 'services7', coalesce(inc.n, 0))
                         order by b.is_headquarters desc, coalesce(inc.eur, 0) desc)
                       from bases b left join vb on vb.base_id = b.id left join inc on inc.base_id = b.id where b.org_id = p_org), '[]'),
    'kinds', coalesce((select jsonb_object_agg(k, n) from kinds), '{}'),
    'models', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'image_url', image_url, 'custom', custom, 'n', n) order by n desc) from models), '[]'),
    'roles', coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from cards group by role) r), '{}'),
    'rarity', coalesce((select jsonb_object_agg(rarity, n) from (select rarity, count(*) n from cards group by rarity) r), '{}'),
    'legends', coalesce((select jsonb_agg(jsonb_build_object('name', first_name || ' ' || last_name, 'nickname', nickname, 'role', role,
                          'avatar_url', avatar_url, 'services', services_completed) order by services_completed desc)
                         from cards where rarity = 'leggendaria'), '[]'),
    'services7', coalesce((select sum(n) from inc), 0), 'income7', coalesce((select sum(eur) from inc), 0)
  ) from o
$$;
revoke execute on function public.set_profile_banner(text, text), public.orgs_directory(), public.org_profile(uuid) from public, anon;
grant execute on function public.set_profile_banner(text, text), public.orgs_directory(), public.org_profile(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO profili', count(*) from orgs_directory();
