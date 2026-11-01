-- AUTISTA AVANZATO: un autista può essere anche soccorritore avanzato.
-- Emergenze 118: servono 1 autista + almeno 2 avanzati (l'autista avanzato conta come uno dei due).
alter table volunteers add column if not exists avanzato boolean not null default false;
update volunteers set avanzato = false where role <> 'autista';

-- I 5 autisti più bravi nel soccorso diventano avanzati
update volunteers set avanzato = true where id in (
  select id from volunteers where role = 'autista' order by stat_soccorso desc, id limit 5);

create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, v.role, v.rarity, v.gender, v.avatar_url,
       v.stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id();

-- Requisiti delle emergenze: autista + 2 avanzati (un caposervizio vale come avanzato)
create or replace function normalize_emergency_roles() returns trigger
language plpgsql as $$
declare capo int;
begin
  if new.category = 'emergenza_118' then
    capo := coalesce((new.required_roles->>'caposervizio')::int, 0);
    new.required_roles := jsonb_strip_nulls(jsonb_build_object(
      'autista', 1,
      'caposervizio', nullif(capo, 0),
      'soccorritore_avanzato', nullif(greatest(2 - capo, coalesce((new.required_roles->>'soccorritore_avanzato')::int, 0)), 0)));
  end if;
  return new;
end $$;
drop trigger if exists missions_emergency_roles on missions;
create trigger missions_emergency_roles before insert or update of required_roles, category on missions
  for each row execute function normalize_emergency_roles();
update missions set required_roles = required_roles
 where category = 'emergenza_118' and status = 'aperta' and expires_at > now();

-- claim_mission: l'autista avanzato conta anche come soccorritore avanzato
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('vol_avanzato' in src) = 0 then
    src := replace(src, 'select ci.*, vo.role, vo.id as vol_id', 'select ci.*, vo.role, vo.id as vol_id, vo.avanzato as vol_avanzato');
    src := replace(src, 'if card.role = ''autista'' then n_autisti := n_autisti + 1;',
                        'if card.role = ''autista'' then n_autisti := n_autisti + 1; if card.vol_avanzato then ranks := ranks || 2; end if;');
    -- mai da soli: almeno 2 persone a bordo
    src := replace(src, 'if cardinality(p_card_ids) > 4 then raise exception ''TOO_MANY_CREW''; end if;',
                        'if cardinality(p_card_ids) > 4 then raise exception ''TOO_MANY_CREW''; end if;
  if cardinality(p_card_ids) < 2 then raise exception ''TOO_FEW_CREW''; end if;');
    execute src;
  end if;
end $do$;

select (select count(*) from volunteers where avanzato) autisti_avanzati,
       position('vol_avanzato' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as claim_ok,
       position('TOO_FEW_CREW' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as minimo2_ok;
