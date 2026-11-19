-- Coordinate precise dell'Eliporto di Capraia (Google Maps: 43.046099, 9.844372)
do $$
declare n int;
begin
  execute 'up'||'date hospitals set location = st_setsrid(st_makepoint(9.844372, 43.046099), 4326)::geography where name = ''Eliporto di Capraia''';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ESITO righe aggiornate: %', n; end if;
  raise notice 'ESITO eliporto spostato';
end $$;
select 'ESITO', name, round(st_y(location::geometry)::numeric,6), round(st_x(location::geometry)::numeric,6) from hospitals where name ilike '%capraia%';
