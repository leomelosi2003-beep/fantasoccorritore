-- 214: La Spezia c'era già ("Sant'Andrea (La Spezia)"): tolgo il doppione appena creato (se fosse già usato, fallisce e non cambia nulla)
select 'PRIMA', name, round(st_y(location::geometry)::numeric,4) lat, round(st_x(location::geometry)::numeric,4) lng, capabilities from hospitals where name ~ 'Spezia';
delete from hospitals where name = 'Ospedale della Spezia (Sant''Andrea)';
select 'ESITO dopo', name from hospitals where name ~ 'Spezia';
