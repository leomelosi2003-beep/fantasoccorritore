-- Elba: si scarica sempre a Portoferraio. Livorno accetta anche i rossi traumatici (trauma_maggiore).
update hospitals set capabilities = array(select distinct unnest(capabilities || array['trauma_maggiore'])) where name = 'Ospedale di Livorno';
create or replace function public.nearest_hospital(p_point geography, p_need text)
 returns uuid language sql stable security definer set search_path to 'public', 'extensions' as $function$
  select coalesce(
    (select id from hospitals where name = 'Ospedale di Portoferraio (Elba)'
      and st_y(p_point::geometry) between 42.70 and 42.90 and st_x(p_point::geometry) between 10.05 and 10.45),
    (select id from hospitals
      where capabilities @> array[case when p_need in ('dimissione') or p_need is null then 'ps' else p_need end]
      order by st_distance(location, p_point) limit 1))
$function$;
