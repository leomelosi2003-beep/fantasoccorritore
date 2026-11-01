-- STANCHEZZA: ogni volontario fa fino a 15 servizi di fila senza riposare.
-- Ogni servizio toglie 1/15 di energia; al 15° va a riposo per 3 ore e poi riparte da 100%.
alter table card_inventory add column if not exists services_since_rest int not null default 0;

-- L'energia non si ricarica più col tempo: dipende solo dai servizi fatti
create or replace function current_energy(p_card_id uuid) returns numeric
language sql stable as $$ select energy from card_inventory where id = p_card_id $$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('complete_due_assignments()'::regprocedure);
  if position('services_since_rest' in src) = 0 then
    src := regexp_replace(src,
      'update card_inventory\s+set energy = greatest\(0, energy - f\).*?where id = cr\.card_id;',
      'update card_inventory
         set services_since_rest = case when services_since_rest + 1 >= 15 then 0 else services_since_rest + 1 end,
             energy = case when services_since_rest + 1 >= 15 then 0
                           else round(100 - (services_since_rest + 1) * 100.0 / 15, 1) end,
             energy_updated_at = now(),
             state = case when services_since_rest + 1 >= 15 then ''riposo''::card_state else ''attiva''::card_state end,
             rest_until = case when services_since_rest + 1 >= 15 then now() + interval ''3 hours'' else null end,
             services_completed = services_completed + 1
       where id = cr.card_id;');
    src := replace(src, 'update card_inventory set state = ''attiva''
   where state = ''riposo'' and rest_until <= now();',
      'update card_inventory set state = ''attiva'', energy = 100, energy_updated_at = now(), services_since_rest = 0
   where state = ''riposo'' and rest_until <= now();');
    execute src;
  end if;

  -- niente più "troppo stanco": conta solo se è a riposo
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := regexp_replace(src, 'if current_energy\(card\.id\) < mission_fatigue\(m\.id, card\.vol_id, now\(\)\) then\s*raise exception ''CARD_TOO_TIRED:%'', card\.id; end if;', '');
  execute src;
end $do$;

-- tutti ripartono freschi (tranne chi è in servizio o a un corso)
update card_inventory set energy = 100, energy_updated_at = now(), services_since_rest = 0,
       state = case when state = 'riposo' and (training_until is null or training_until <= now()) then 'attiva'::card_state else state end,
       rest_until = case when training_until is not null and training_until > now() then rest_until else null end
 where state <> 'in_servizio';

-- l'app mostra quanti servizi mancano al riposo
create or replace view my_cards with (security_invoker = true) as
select ci.id, ci.state, ci.rest_until, ci.expires_at, ci.acquired_at, ci.services_completed, ci.base_id,
       round(current_energy(ci.id), 1) as energy,
       v.id as volunteer_id, v.first_name, v.last_name, v.nickname, coalesce(ci.role_override, v.role) as role,
       v.rarity, v.gender, v.avatar_url,
       coalesce(ci.guida_override, v.stat_guida) as stat_guida, v.stat_soccorso, v.stat_resilienza, v.pros, v.cons, v.avanzato,
       case when ci.org_id = my_org_id() then (select name from organizations where id = card_borrower(ci.id)) end as lent_to,
       case when ci.org_id <> my_org_id() then (select name from organizations where id = ci.org_id) end as lent_from,
       ci.training_until, ci.role_override is not null as promoted,
       15 - ci.services_since_rest as services_left
from card_inventory ci join volunteers v on v.id = ci.volunteer_id
where ci.org_id = my_org_id() or card_borrower(ci.id) = my_org_id();

select position('services_since_rest' in pg_get_functiondef('complete_due_assignments()'::regprocedure)) > 0 as fine_servizio_ok,
       position('energy = 100' in pg_get_functiondef('complete_due_assignments()'::regprocedure)) > 0 as riposo_ok,
       position('CARD_TOO_TIRED' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) = 0 as stanco_tolto;
