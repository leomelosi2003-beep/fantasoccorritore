-- 223: scena incendi, modello AIB preciso (daily, ranger, scorpio)
create or replace function public.maxi_scene(p_mission uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $f$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description, 'venue', m.venue,
    'lat', st_y(m.location::geometry), 'lng', st_x(m.location::geometry),
    'created_at', m.created_at, 'ends_at', coalesce(m.event_ends_at, m.expires_at), 'status', m.status,
    'now', now(),
    'hospital', (select jsonb_build_object('name', h.name, 'lat', st_y(h.location::geometry), 'lng', st_x(h.location::geometry))
                   from hospitals h where h.id = nearest_hospital(m.location, null)),
    'fire', (select jsonb_build_object('severity', w.severity, 'intensity', round(w.intensity), 'base_radius', w.base_radius)
               from wildfires w where w.mission_id = m.id),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'call_sign', v.call_sign, 'org_name', o.name, 'mine', a.org_id = my_org_id(),
        'status', a.status, 'assigned_at', a.assigned_at, 'arrives_at', a.arrives_at, 'completes_at', a.completes_at,
        'base_lat', st_y(b.location::geometry), 'base_lng', st_x(b.location::geometry),
        'automedica', coalesce(vm.automedica, false), 'moto', coalesce(vm.moto, false),
        'pma', coalesce(vm.pma, false) or 'pma_tenda' = any(v.equipment), 'long', coalesce(vm.transfer_only, false),
        'maxi', case when coalesce(vm.maxi, false) then (case when vm.maxi_slots >= 3 then 'camion' else 'furgone' end) end,
        'modules', (select coalesce(jsonb_agg(e.code), '[]'::jsonb) from equipment e where e.code = any(v.equipment) and e.slot like 'maxi\_%'),
        'aib', case when coalesce(vm.aib, false) then (case when vm.name ilike '%daily%' then 'daily' when vm.name ilike '%scorpio%' then 'scorpio' else 'ranger' end) end,
        'route', case when coalesce(vm.aib, false) then a.route end
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
select 'ESITO modelli AIB ok';
