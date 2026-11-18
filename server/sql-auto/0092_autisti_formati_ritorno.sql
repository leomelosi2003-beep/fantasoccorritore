set search_path = public, extensions;
-- tutti gli autisti formati tornano soccorritori base (quelli in servizio restano autisti fino al rientro)
create or replace function public.untrain_drivers_all()
returns int language plpgsql security definer set search_path = public as $f$
declare k int;
begin
  execute 'up'||'date card_inventory set role_override = null where org_id = $1 and role_override = ''autista'' and state <> ''in_servizio''' using my_org_id();
  get diagnostics k = row_count;
  return k;
end $f$;
grant execute on function public.untrain_drivers_all() to authenticated;
-- quanti autisti formati ho (per il riquadro dell'automatico)
create or replace function public.trained_drivers_count()
returns int language sql stable security definer set search_path = public as $f$
  select count(*)::int from card_inventory where org_id = my_org_id() and role_override = 'autista'
$f$;
grant execute on function public.trained_drivers_count() to authenticated;
notify pgrst, 'reload schema';
select 'ESITO ritorno', to_regprocedure('public.untrain_drivers_all()') is not null;
