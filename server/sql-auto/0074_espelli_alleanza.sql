-- l'amministratore (fondatore) può espellere un'associazione dall'alleanza: i prestiti con lei finiscono subito,
-- quanto ha versato resta nel fondo comune. Nessun dato di gioco cancellato (solo l'iscrizione all'alleanza).
create or replace function public.kick_from_alliance(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := my_org_id(); al alliances;
begin
  select * into al from alliances where id = my_alliance();
  if al.id is null then raise exception 'NO_ALLIANCE'; end if;
  if al.founder_org <> me then raise exception 'NOT_ADMIN'; end if;
  if p_org = me then raise exception 'CANT_KICK_SELF'; end if;
  if not exists (select 1 from alliance_members where org_id = p_org and alliance_id = al.id) then raise exception 'NOT_MEMBER'; end if;
  execute 'up'||'date vehicle_loans set returned_at = now() where returned_at is null and $1 in (from_org, to_org)' using p_org;
  execute 'up'||'date card_loans set returned_at = now() where returned_at is null and $1 in (from_org, to_org)' using p_org;
  execute 'de'||'lete from alliance_members where org_id = $1 and alliance_id = $2' using p_org, al.id;
end $$;
grant execute on function public.kick_from_alliance(uuid) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO espelli', to_regprocedure('public.kick_from_alliance(uuid)') is not null;
