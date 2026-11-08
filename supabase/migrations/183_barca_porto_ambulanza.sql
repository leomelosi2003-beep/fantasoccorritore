-- 183: barche che portano il paziente in porto e aspettano una mia ambulanza.
-- La regola c'era gia' (claim_mission_as: l'ambulanza "compagna" della barca va al porto), ma il servizio
-- spariva dalla mappa appena la barca lo prendeva. Questa funzione elenca le consegne in attesa, con
-- coordinate = PORTO, cosi' il sito mostra una bandierina "!" sul porto e apre il servizio da li'.
create or replace function public.my_port_handoffs()
returns table(
  boat_assignment uuid, boat_call_sign text, port_id int, port_name text, at_port timestamptz, wait_until timestamptz,
  id uuid, code text, title text, category text, description text, venue text, slots_total int, slots_taken int,
  reward_funds int, expires_at timestamptz, status text, requires text[], required_roles jsonb, min_certification text,
  event_id uuid, event_ends_at timestamptz, transport text, lat float8, lng float8, my_automedica_waiting boolean)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, v.call_sign, p.id, p.name, a.completes_at - interval '15 minutes', a.completes_at,
         m.id, m.code::text, m.title, m.category::text, m.description, m.venue, m.slots_total, m.slots_taken,
         m.reward_funds, m.expires_at, m.status::text, m.requires, m.required_roles, m.min_certification::text,
         m.event_id, m.event_ends_at, m.transport,
         st_y(p.location::geometry), st_x(p.location::geometry), true
    from mission_assignments a
    join vehicles v on v.id = a.vehicle_id
    join vehicle_models vm on vm.id = v.model_id and vm.boat
    join ports p on p.id = a.port_id
    join missions m on m.id = a.mission_id
   where a.org_id = my_org_id() and a.status in ('in_viaggio', 'sul_posto') and a.completes_at > now()
     and not exists (select 1 from mission_assignments y where y.companion_of = a.id and y.status <> 'annullata')
   order by a.completes_at
$$;
grant execute on function public.my_port_handoffs() to authenticated;
