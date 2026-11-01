-- Ospedale Felice Lotti di Pontedera (coordinate OpenStreetMap)
insert into hospitals (name, location, capabilities, region, specialty, transfer_dest)
values ('Ospedale di Pontedera (Lotti)', st_setsrid(st_makepoint(10.6342205, 43.6591897), 4326)::geography,
        '{ps,cardio,pediatria,dialisi}', 'Toscana', null, false)
on conflict (name) do nothing;
