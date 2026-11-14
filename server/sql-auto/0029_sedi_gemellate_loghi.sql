-- 229: sedi condivise in gemellaggio: dati dell'associazione gemella per mostrare i due loghi sulla mappa
create or replace function public.base_twins()
returns table(base_id uuid, twin_org uuid, twin_name text, twin_type text, twin_logo text)
language sql stable security definer set search_path = public, extensions as $f$
  select b.id, o.id, o.name, o.type::text, o.logo_url
  from bases b join organizations o on o.id = b.collab_org
  where b.collab_org is not null and are_twinned(b.org_id, b.collab_org)
$f$;
grant execute on function public.base_twins() to authenticated, anon;
notify pgrst, 'reload schema';
select 'ESITO sedi gemellate', count(*) from public.base_twins();
