-- 212 (ritenta 0011): maxi senza PMA → le ambulanze fanno la spola con l'ospedale più vicino (scena + mappa principale)
create or replace function public.maxi_scene(p_mission uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $f$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description, 'venue', m.venue,
    'lat', st_y(m.location::geometry), 'lng', st_x(m.location::geometry),
    'created_at', m.created_at, 'ends_at', coalesce(m.event_ends_at, m.expires_at), 'status', m.status,
    'now', now(),
    'hospital', (select jsonb_build_object('name', h.name, 'lat', st_y(h.location::geometry), 'lng', st_x(h.location::geometry))
                   from hospitals h where h.id = nearest_hospital(m.location, null)),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'call_sign', v.call_sign, 'org_name', o.name, 'mine', a.org_id = my_org_id(),
        'status', a.status, 'assigned_at', a.assigned_at, 'arrives_at', a.arrives_at, 'completes_at', a.completes_at,
        'base_lat', st_y(b.location::geometry), 'base_lng', st_x(b.location::geometry),
        'automedica', coalesce(vm.automedica, false), 'moto', coalesce(vm.moto, false), 'pma', coalesce(vm.pma, false), 'long', coalesce(vm.transfer_only, false)
      ) order by a.assigned_at)
      from mission_assignments a
      join vehicles v on v.id = a.vehicle_id
      join vehicle_models vm on vm.id = v.model_id
      join organizations o on o.id = a.org_id
      left join bases b on b.id = v.base_id
      where a.mission_id = m.id and a.status <> 'annullata'), '[]'::jsonb)
  )
  from missions m where m.id = p_mission and m.category = 'grande_evento'
$f$;

-- ambulanze sulle maxi in corso senza PMA sul posto: per disegnarle sulla mappa mentre vanno e tornano dall'ospedale
create or replace function public.maxi_shuttles()
returns table(id uuid, vehicle_id uuid, mission_id uuid, call_sign text, org_name text, org_type text, mine boolean,
              vehicle_image text, lat double precision, lng double precision,
              hospital text, h_lat double precision, h_lng double precision, arrives_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public, extensions as $f$
  select a.id, a.vehicle_id, m.id, v.call_sign, o.name, o.type::text, a.org_id = my_org_id(), vm.image_url,
         st_y(m.location::geometry), st_x(m.location::geometry),
         h.name, st_y(h.location::geometry), st_x(h.location::geometry), a.arrives_at, coalesce(m.event_ends_at, m.expires_at)
  from missions m
  join mission_assignments a on a.mission_id = m.id
  join vehicles v on v.id = a.vehicle_id
  join vehicle_models vm on vm.id = v.model_id
  join organizations o on o.id = a.org_id
  join hospitals h on h.id = nearest_hospital(m.location, null)
  where m.category = 'grande_evento' and m.event_id is null and coalesce(m.venue, '') <> 'AIB'
    and m.status in ('aperta', 'completa', 'in_corso')
    and a.status::text not in ('annullata', 'conclusa', 'rientro') and a.arrives_at <= now()
    and not coalesce(vm.pma, false) and not coalesce(vm.automedica, false) and not coalesce(vm.moto, false)
    and coalesce(vm.boat, false) = false
    and not exists (select 1 from mission_assignments p join vehicles pv on pv.id = p.vehicle_id
                    join vehicle_models pm on pm.id = pv.model_id
                    where p.mission_id = m.id and coalesce(pm.pma, false) and p.arrives_at <= now()
                      and p.status::text not in ('annullata', 'conclusa', 'rientro'))
$f$;
grant execute on function public.maxi_shuttles() to authenticated, anon;
notify pgrst, 'reload schema';
select 'ESITO ok spola ospedale maxi', count(*) from public.maxi_shuttles();
