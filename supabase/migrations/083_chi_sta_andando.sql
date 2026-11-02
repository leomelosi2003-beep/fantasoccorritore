-- Popup del servizio: chi sta andando (rpc mission_responders).
create or replace function public.mission_responders(p_mission uuid)
returns table(org_name text, org_type text, logo_url text, call_sign text, status text, arrives_at timestamptz, mine boolean, support boolean)
language sql stable security definer set search_path = public as $$
  select o.name, o.type::text, o.logo_url, v.call_sign, a.status::text, a.arrives_at, a.org_id = my_org_id(), a.support
    from mission_assignments a join organizations o on o.id = a.org_id join vehicles v on v.id = a.vehicle_id
   where a.mission_id = p_mission and a.status in ('in_viaggio', 'sul_posto')
   order by a.arrives_at
$$;
grant execute on function public.mission_responders(uuid) to authenticated;
