-- Logo personalizzato dell'associazione + modifica di nome e stile
alter table organizations add column if not exists logo_url text;

-- Niente più modifica diretta della tabella (si potevano cambiare i fondi): si passa dalla funzione
drop policy if exists "edit own org theme" on organizations;

create or replace function update_org_branding(p_name text, p_type org_type, p_logo_url text)
returns organizations language plpgsql security definer set search_path = public, extensions as $$
declare o organizations; v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  if char_length(trim(p_name)) not between 3 and 60 then raise exception 'BAD_NAME'; end if;
  if p_logo_url is not null and position('/storage/v1/object/public/org-logos/' || v_org::text || '/' in p_logo_url) = 0 then
    raise exception 'BAD_LOGO'; end if;
  update organizations set name = trim(p_name), type = p_type, logo_url = p_logo_url
   where id = v_org returning * into o;
  return o;
end $$;
grant execute on function update_org_branding(text, org_type, text) to authenticated;

create or replace view bases_map with (security_invoker = true) as
select b.id, b.org_id, b.name, b.level, b.is_headquarters,
       o.name as org_name, o.type as org_type, o.theme,
       st_y(b.location::geometry) as lat, st_x(b.location::geometry) as lng, o.logo_url
from bases b join organizations o on o.id = b.org_id;

-- Spazio per i loghi: ognuno scrive solo nella cartella della sua associazione
insert into storage.buckets (id, name, public) values ('org-logos', 'org-logos', true) on conflict (id) do nothing;
drop policy if exists "org logos insert" on storage.objects;
drop policy if exists "org logos update" on storage.objects;
drop policy if exists "org logos delete" on storage.objects;
drop policy if exists "org logos read" on storage.objects;
create policy "org logos read" on storage.objects for select to authenticated using (bucket_id = 'org-logos');
create policy "org logos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
create policy "org logos update" on storage.objects for update to authenticated
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);
create policy "org logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and (storage.foldername(name))[1] = public.my_org_id()::text);

select 'ok' as logo;
