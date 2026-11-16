-- Pacchetti epico e leggendario molto più cari: devono essere un sacrificio (epico 250.000 €, leggendario 1.000.000 €).
do $$
declare cur jsonb := pack_catalog(); nw jsonb;
begin
  select jsonb_agg(case x->>'kind' when 'epico' then jsonb_set(x, '{price}', '250000')
                                   when 'leggendario' then jsonb_set(x, '{price}', '1000000') else x end order by o)
    into nw from jsonb_array_elements(cur) with ordinality t(x, o);
  execute format('create or replace function public.pack_catalog() returns jsonb language sql stable as %L',
                 'select ' || quote_literal(nw::text) || '::jsonb');
end $$;
grant execute on function public.pack_catalog() to anon, authenticated;
notify pgrst, 'reload schema';
select 'ESITO prezzi', x->>'kind', x->>'price' from jsonb_array_elements(pack_catalog()) x where x->>'kind' in ('comune','epico','leggendario','ruolo_autista','ruolo_autista_avanzato');
