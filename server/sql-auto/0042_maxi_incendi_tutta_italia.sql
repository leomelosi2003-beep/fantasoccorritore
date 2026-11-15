-- 242: maxi emergenze e incendi in tutta Italia (punto a caso tra i comuni italiani), maxi ogni 5-6 giorni invece di 7-8
do $$
declare src text; n text;
  old_sel text := 'select b.location, b.name into bl, bname from bases b
   order by (select count(distinct b2.org_id) from bases b2 where st_dwithin(b2.location, b.location, 25000)) desc, random()
   limit 1;';
  new_sel text := 'select s.location, s.city into bl, bname from italy_spots s order by random() limit 1;   -- tutta Italia
  if bl is null then select b.location, b.name into bl, bname from bases b order by random() limit 1; end if;';
begin
  src := pg_get_functiondef('public.spawn_maxi_emergency'::regproc);
  n := replace(src, old_sel, new_sel);
  if n = src then raise exception 'spawn_maxi_emergency non patchata'; end if;
  execute n;
  src := pg_get_functiondef('public.spawn_wildfire'::regproc);
  n := replace(src, old_sel, new_sel);
  if n = src then raise exception 'spawn_wildfire non patchata'; end if;
  execute n;
  src := pg_get_functiondef('public.spawn_maxi_if_due'::regproc);
  n := replace(src, 'make_interval(days => 7) + make_interval(hours => floor(random()*24)::int); -- 7..8 giorni',
                    'make_interval(days => 5) + make_interval(hours => floor(random()*24)::int); -- 5..6 giorni');
  if n = src then raise exception 'spawn_maxi_if_due non patchata'; end if;
  execute n;
end $$;
select 'ESITO italia', count(*) comuni, round(min(st_y(location::geometry))::numeric,1) lat_min, round(max(st_y(location::geometry))::numeric,1) lat_max,
       round(min(st_x(location::geometry))::numeric,1) lng_min, round(max(st_x(location::geometry))::numeric,1) lng_max from italy_spots;
