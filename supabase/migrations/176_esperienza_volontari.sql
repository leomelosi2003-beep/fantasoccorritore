-- 176: Esperienza dei volontari.
-- Il livello si ricava da card_inventory.services_completed (gia' esistente, nessun dato nuovo):
--   1 Recluta (0) · 2 Esperto (25) · 3 Veterano (100) · 4 Senior (300) · 5 Istruttore (600)
-- Ogni volontario dell'equipaggio sopra il livello 1 aggiunge +1% al premio per livello, tetto +10% a servizio.
-- La stanchezza c'era gia' (energia / riposo) e resta com'e'.

create or replace function public.card_level(p_services int)
returns int language sql immutable as $$
  select case when coalesce(p_services,0) >= 600 then 5 when p_services >= 300 then 4
              when p_services >= 100 then 3 when p_services >= 25 then 2 else 1 end
$$;
grant execute on function public.card_level(int) to anon, authenticated;

do $$
declare src text; anchor text := E'    reward := round(reward * (1 + clinical_bonus(a.id, m.title, m.code::text)));';
begin
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  if position('card_level(' in src) = 0 then
    if position(anchor in src) = 0 then raise exception 'ancora non trovata in complete_due_assignments'; end if;
    src := replace(src, anchor,
      E'    -- esperienza dell''equipaggio: +1% per livello sopra il primo, tetto +10%\n' ||
      E'    reward := round(reward * (1 + coalesce((select least(0.10, sum(card_level(ci.services_completed) - 1) * 0.01)\n' ||
      E'                                              from assignment_crew ac join card_inventory ci on ci.id = ac.card_id\n' ||
      E'                                             where ac.assignment_id = a.id), 0)));\n' || anchor);
    execute src;
  end if;
end $$;
