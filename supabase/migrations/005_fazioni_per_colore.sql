-- Fazioni senza nomi reali: solo tre stili di colore. Il nome lo sceglie sempre il giocatore.
drop view if exists bases_map;
drop function if exists create_organization(text, org_type, jsonb, text, double precision, double precision);

alter table organizations alter column type type text;
drop type org_type;
create type org_type as enum ('blu_giallo','arancio_nero','rosso_bianco');
alter table organizations alter column type type org_type using type::org_type;

create or replace view bases_map with (security_invoker = true) as
select b.id, b.org_id, b.name, b.level, b.is_headquarters,
       o.name as org_name, o.type as org_type, o.theme,
       st_y(b.location::geometry) as lat,
       st_x(b.location::geometry) as lng
from bases b join organizations o on o.id = b.org_id;
grant select on bases_map to anon, authenticated;

create or replace function create_organization(
  p_name text, p_type org_type, p_theme jsonb,
  p_base_name text, p_lng double precision, p_lat double precision
) returns organizations
language plpgsql security definer set search_path = public, extensions as $$
declare o organizations; def jsonb;
begin
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
end $$;
grant execute on function create_organization(text, org_type, jsonb, text, double precision, double precision) to authenticated;
