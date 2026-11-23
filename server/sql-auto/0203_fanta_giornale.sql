-- FantaGiornale 24: tutto quello che serve alla prima pagina, in una sola chiamata
create or replace function public.fanta_giornale()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with day as (select (date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome') d0)
  select jsonb_build_object(
    'now', now(),
    'numeri', (select jsonb_build_object(
        'servizi_oggi', (select count(*) from mission_assignments a, day where a.status = 'conclusa' and a.completes_at >= day.d0),
        'rossi_oggi', (select count(*) from mission_assignments a join missions m on m.id = a.mission_id, day where a.status = 'conclusa' and a.completes_at >= day.d0 and m.code = 'rosso'),
        'associazioni', (select count(*) from organizations),
        'mezzi', (select count(*) from vehicles),
        'sedi', (select count(*) from bases),
        'in_strada', (select count(*) from mission_assignments a where a.status in ('in_viaggio', 'sul_posto')))),
    'emergenze', coalesce((select jsonb_agg(jsonb_build_object('title', m.title, 'description', left(m.description, 220), 'venue', m.venue,
          'tipo', case when m.venue = 'AIB' then 'incendio' else 'maxi' end, 'mezzi', (select count(*) from mission_assignments a where a.mission_id = m.id and a.status <> 'annullata'),
          'ends_at', m.event_ends_at, 'lat', st_y(m.location::geometry), 'lng', st_x(m.location::geometry)) order by m.created_at desc)
        from missions m where m.category = 'grande_evento' and m.event_id is null and m.status <> 'conclusa' and coalesce(m.event_ends_at, now()) > now()), '[]'),
    'eventi', coalesce((select jsonb_agg(jsonb_build_object('title', e.title, 'venue', e.venue, 'kind', e.kind, 'show_at', e.show_at,
          'score', (select jsonb_build_object('t1', s.team1, 't2', s.team2, 's1', s.score1, 's2', s.score2) from event_scores s where s.event_id = e.id)) order by e.show_at)
        from events e where e.show_at between now() - interval '6 hours' and now() + interval '2 days'), '[]'),
    'livree', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
        select jsonb_build_object('name', l.name, 'org', o.name, 'org_id', o.id, 'logo', o.logo_url, 'model', vm.name, 'image', l.image_url,
               'votes', (select count(*) from livery_votes v where v.livery_id = l.id), 'at', l.updated_at) x
          from liveries l join organizations o on o.id = l.org_id join vehicle_models vm on vm.id = l.model_id
         where l.image_url is not null and l.updated_at > now() - interval '7 days' order by l.updated_at desc limit 8) q), '[]'),
    'sedi_nuove', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('name', b.name, 'org', o.name, 'org_id', o.id, 'logo', o.logo_url, 'color', b.color, 'at', b.built_at,
               'hq', b.is_headquarters, 'rented', coalesce(b.rented, false), 'lat', st_y(b.location::geometry), 'lng', st_x(b.location::geometry)) x
          from bases b join organizations o on o.id = b.org_id where b.built_at > now() - interval '7 days' order by b.built_at desc limit 8) q), '[]'),
    'nuove_associazioni', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('name', o.name, 'id', o.id, 'logo', o.logo_url, 'type', o.type, 'at', o.created_at) x
          from organizations o where o.created_at > now() - interval '7 days' order by o.created_at desc limit 6) q), '[]'),
    'podio', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('name', o.name, 'id', o.id, 'logo', o.logo_url, 'type', o.type, 'points', sb.points) x
          from season_board(date_trunc('month', now() at time zone 'Europe/Rome')::date) sb join organizations o on o.id = sb.org_id
         order by sb.points desc limit 3) q), '[]'),
    'mezzi_nuovi', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('model', vm.name, 'image', vm.image_url, 'n', count(*)) x
          from vehicles v join vehicle_models vm on vm.id = v.model_id where v.created_at > now() - interval '24 hours'
         group by vm.name, vm.image_url order by count(*) desc limit 4) q), '[]')
  )
$$;
grant execute on function public.fanta_giornale() to authenticated;
do $$ declare j jsonb; t0 timestamptz := clock_timestamp(); begin
  j := fanta_giornale();
  raise notice 'ESITO giornale pronto: % caratteri in % ms, livree %, sedi %, eventi %, emergenze %', length(j::text),
    round(extract(epoch from clock_timestamp() - t0) * 1000), jsonb_array_length(j->'livree'), jsonb_array_length(j->'sedi_nuove'),
    jsonb_array_length(j->'eventi'), jsonb_array_length(j->'emergenze');
end $$;
