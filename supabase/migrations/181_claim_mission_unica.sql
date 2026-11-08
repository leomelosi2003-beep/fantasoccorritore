-- 181: le barche non partivano con l'invio a mano ("BOAT_CREW" anche con bagnino + soccorritore).
-- Causa: dalla migr. 157 in poi tutte le regole sono state aggiornate solo in claim_mission_as
-- (usata dall'automatico), mentre il sito chiama claim_mission, rimasta una copia vecchia
-- (barca = autista + soccorritore, niente regole su passi lunghi/ordinarie/AIB/bagnini).
-- Ora claim_mission e' solo un involucro: una sola funzione con le regole, impossibile che divergano.
-- Copia della vecchia versione salvata come claim_mission_old (non usata), per sicurezza.

do $$
declare src text;
begin
  if to_regprocedure('public.claim_mission_old(uuid, uuid, uuid[])') is null then
    src := pg_get_functiondef('public.claim_mission(uuid, uuid, uuid[])'::regprocedure);
    src := replace(src, 'FUNCTION public.claim_mission(', 'FUNCTION public.claim_mission_old(');
    execute src;
    revoke all on function public.claim_mission_old(uuid, uuid, uuid[]) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.claim_mission(p_mission_id uuid, p_vehicle_id uuid, p_card_ids uuid[])
returns mission_assignments
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_org uuid := my_org_id();
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  perform complete_due_assignments();
  return claim_mission_as(v_org, p_mission_id, p_vehicle_id, p_card_ids);
end $$;
revoke all on function public.claim_mission(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.claim_mission(uuid, uuid, uuid[]) to authenticated;
