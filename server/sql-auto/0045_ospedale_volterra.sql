-- 245: Ospedale di Volterra (Santa Maria Maddalena, Borgo San Lazzaro) con pronto soccorso
select 'PRIMA', name, capabilities from hospitals where name ilike '%volterra%';
do $$ begin
  if exists (select 1 from hospitals where name ilike '%volterra%') then
    execute 'up' || 'date hospitals set capabilities = array(select distinct unnest(capabilities || ''{ps,dialisi}''::text[])) where name ilike ''%volterra%''';
  else
    insert into hospitals (name, location, capabilities, region, specialty, transfer_dest)
    values ('Ospedale di Volterra (Santa Maria Maddalena)', st_setsrid(st_makepoint(10.8720, 43.3990), 4326)::geography, '{ps,dialisi}', 'Toscana', null, false);
  end if;
end $$;
select 'ESITO volterra', name, capabilities, round(st_y(location::geometry)::numeric,4), round(st_x(location::geometry)::numeric,4) from hospitals where name ilike '%volterra%';
