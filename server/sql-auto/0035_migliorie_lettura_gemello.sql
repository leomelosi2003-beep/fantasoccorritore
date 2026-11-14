-- 235: le migliorie di una sede condivisa si vedono anche dal gemello (prima risultavano a 0 e sembrava che l'acquisto non funzionasse)
drop policy if exists base_perks_read on public.base_perks;
create policy base_perks_read on public.base_perks for select to authenticated
  using (public.can_manage_base(base_id, public.my_org_id()));
select 'ESITO migliorie visibili al gemello';
