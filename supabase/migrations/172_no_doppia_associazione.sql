-- 172: rete di sicurezza — non creare una seconda associazione se l'utente ne ha già una.
create or replace function public.create_organization(p_name text, p_type org_type, p_theme jsonb, p_base_name text, p_lng double precision, p_lat double precision)
 returns organizations language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare o organizations; def jsonb;
begin
  if auth.uid() is null then raise exception 'NO_SESSION'; end if;
  select * into o from organizations where owner_id = auth.uid();
  if found then return o; end if;   -- ne ha già una: restituisci quella, niente duplicati
  def := case p_type
    when 'blu_giallo'   then '{"primary":"#1E3A8A","secondary":"#FACC15"}'
    when 'arancio_nero' then '{"primary":"#F97316","secondary":"#111111","accent":"#FFFFFF"}'
    else                     '{"primary":"#DC2626","secondary":"#FFFFFF"}'
  end::jsonb;
  insert into organizations (owner_id, name, type, theme)
  values (auth.uid(), p_name, p_type, def || coalesce(p_theme, '{}'::jsonb))
  returning * into o;
  perform build_base(p_base_name, p_lng, p_lat);
  return o;
end $fn$;
