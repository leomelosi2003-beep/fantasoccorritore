-- Viste per la mappa: espongono lat/lng leggibili dal frontend
-- (la colonna geography arriva al client come WKB esadecimale).

create or replace view missions_map with (security_invoker = true) as
select id, category, code, title, venue, slots_total, slots_taken,
       required_roles, min_certification, reward_funds, expires_at, status,
       st_y(location::geometry) as lat,
       st_x(location::geometry) as lng
from missions
where status in ('aperta','completa','in_corso');

create or replace view bases_map with (security_invoker = true) as
select b.id, b.org_id, b.name, b.level, b.is_headquarters,
       o.name as org_name, o.type as org_type, o.theme,
       st_y(b.location::geometry) as lat,
       st_x(b.location::geometry) as lng
from bases b join organizations o on o.id = b.org_id;

grant select on missions_map, bases_map to authenticated;

-- Crea il profilo alla registrazione
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username',
                           split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- Onboarding: crea associazione + prima sede in un colpo solo
create or replace function create_organization(
  p_name text, p_type org_type, p_theme jsonb,
  p_base_name text, p_lng double precision, p_lat double precision
) returns organizations
language plpgsql security definer set search_path = public, extensions as $$
declare o organizations;
begin
  insert into organizations (owner_id, name, type, theme)
  values (auth.uid(), p_name, p_type, coalesce(p_theme, '{}'::jsonb))
  returning * into o;
  perform build_base(p_base_name, p_lng, p_lat);   -- prima sede gratuita
  return o;
end $$;
