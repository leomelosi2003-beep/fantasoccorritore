-- Più servizi, vicino alle sedi; servizi oltre 15 km dalla sede del mezzo non si possono prendere.
do $do$
declare src text;
begin
  src := pg_get_functiondef('generate_missions()'::regprocedure);
  src := replace(src, 'to_create := least(4, 40 - open_count);',
    'to_create := least(3 + (select count(*) from bases)::int, 15 + 5 * (select count(*) from bases)::int - open_count);');
  src := replace(src, 'select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
      from mission_spots offset floor(random() * (select count(*) from mission_spots)) limit 1;',
    'z := null;
    -- 3 volte su 4 vicino a una sede a caso (entro 10 km), altrimenti ovunque
    select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
      from mission_spots s where (select random()) < 0.75 and st_dwithin(s.location, (select location from bases order by random() limit 1), 10000)
     order by random() limit 1;
    if z.name is null then
      select comune as name, st_y(location::geometry) as lat, st_x(location::geometry) as lng into z
        from mission_spots offset floor(random() * (select count(*) from mission_spots)) limit 1;
    end if;');
  execute src;

  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('TOO_FAR' in src) = 0 then
    src := replace(src, '  select * into b from bases where id = veh.base_id;',
      '  select * into b from bases where id = veh.base_id;
  if not st_dwithin(b.location, m.location, 15000) then raise exception ''TOO_FAR''; end if;');
    execute src;
  end if;
end $do$;
select cron.schedule('generate-missions', '*/2 * * * *', $$select generate_missions()$$);

create or replace view my_fleet with (security_invoker = true) as
select v.id, v.call_sign, v.status, v.wear, v.certification, v.equipment, v.base_id, v.org_id,
       v.org_id = my_org_id() as mine,
       (select name from organizations where id = vehicle_borrower(v.id) and v.org_id = my_org_id()) as lent_to,
       case when v.org_id <> my_org_id() then (select name from organizations where id = v.org_id) end as lent_from,
       v.maintenance_until, (select image_url from vehicle_models where id = v.model_id) as vehicle_image,
       (select name from bases where id = v.base_id) as base_name,
       (select st_y(location::geometry) from bases where id = v.base_id) as base_lat,
       (select st_x(location::geometry) from bases where id = v.base_id) as base_lng
from vehicles v
where v.org_id = my_org_id() or vehicle_borrower(v.id) = my_org_id();
