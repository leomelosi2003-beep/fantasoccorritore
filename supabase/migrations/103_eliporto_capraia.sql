-- Capraia: i servizi scaricano all'Eliporto di Capraia (consegna all'elisoccorso), coordinate approssimate.
insert into hospitals (name, location, capabilities, region, specialty, transfer_dest)
values ('Eliporto di Capraia', st_setsrid(st_makepoint(9.8400, 43.0520), 4326)::geography, '{}', 'Toscana', 'elisoccorso', false)
on conflict (name) do nothing;
-- nearest_hospital: Capraia -> Eliporto, Elba -> Portoferraio, altrimenti il più vicino abilitato. (vedi SQL applicato)
