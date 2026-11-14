-- 209: scena maxi, anche il passo lungo
create or replace function public.maxi_scene(p_mission uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $f$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description, 'venue', m.venue,
    'lat', st_y(m.location::geometry), 'lng', st_x(m.location::geometry),
    'created_at', m.created_at, 'ends_at', coalesce(m.event_ends_at, m.expires_at), 'status', m.status,
    'now', now(),
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
notify pgrst, 'reload schema';
select 'ESITO ok scena maxi con passo lungo';
