-- 237: maxi emergenza lanciata subito su richiesta dell'admin
select spawn_maxi_emergency(3);
select 'ESITO maxi', left(title, 80), st_y(location::geometry) lat, st_x(location::geometry) lng, coalesce(event_ends_at, expires_at) fine
  from missions where category = 'grande_evento' and event_id is null and coalesce(venue, '') <> 'AIB' order by created_at desc limit 1;
