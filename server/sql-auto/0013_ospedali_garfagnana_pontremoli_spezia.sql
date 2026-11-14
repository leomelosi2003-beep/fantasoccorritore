-- 213: nuovi ospedali con pronto soccorso
insert into hospitals (name, location, capabilities, region, specialty, transfer_dest) values
  ('Ospedale di Castelnuovo di Garfagnana (Santa Croce)', st_setsrid(st_makepoint(10.4128, 44.1158), 4326)::geography, '{ps,dialisi}', 'Toscana', null, false),
  ('Ospedale di Pontremoli (Sant''Antonio Abate)',       st_setsrid(st_makepoint(9.8852, 44.3650), 4326)::geography, '{ps,dialisi}', 'Toscana', null, false),
  ('Ospedale della Spezia (Sant''Andrea)',               st_setsrid(st_makepoint(9.8383, 44.1132), 4326)::geography, '{ps,cardio,trauma_maggiore,pediatria,dialisi}', 'Liguria', null, false)
on conflict (name) do nothing;
select 'ESITO ospedali', name, region from hospitals where name ~ 'Garfagnana|Pontremoli|Spezia';
