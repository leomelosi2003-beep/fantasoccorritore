-- Guida più realistica: ogni viaggio è fatto di città (all'inizio e alla fine), strade con curve e rettilinei.
-- In città e nelle curve conta l'AGILITÀ (un mezzo agile come il V-Craftor va più forte di un M-Sprinterix),
-- sui rettilinei conta la VELOCITÀ MASSIMA (lì l'M-Sprinterix recupera). I potenziamenti valgono ovunque.
create or replace function public.drive_seconds(a geography, b geography, p_vmax numeric, p_agi numeric, p_mode text, p_boost numeric default 1)
 returns numeric language sql immutable set search_path to 'public', 'extensions' as $function$
  with k as (select greatest(0.2, st_distance(a, b) / 1000.0 * 1.3) road,
                    coalesce(p_vmax, 150) vmax, least(greatest(coalesce(p_agi, 1), 0.6), 1.25) agi,
                    1 + (greatest(coalesce(p_boost, 1), 0.5) - 1) * 0.4 boost),          -- potenziamenti: effetto ridotto
       d as (select *, least(road, 4.5) city from k),                                     -- 3 km in partenza + 1,5 km all'arrivo
       e as (select *, least(road - city, 8 + 0.15 * greatest(0, road - city - 8)) curvy from d),   -- statali e provinciali con curve
       f as (select *, greatest(0, road - city - curvy) straight from e),                -- superstrade e autostrade
       v as (select city, curvy, straight,
                    least(case p_mode when 'rosso' then 50 when 'giallo' then 44 else 35 end * power(agi, 1.3) * boost,
                          case p_mode when 'rosso' then 62 when 'giallo' then 52 else 42 end) cv,           -- città: agilità
                    least(case p_mode when 'rosso' then 85 when 'giallo' then 75 else 65 end * power(agi, 1.5) * boost,
                          vmax * 0.72, case p_mode when 'rosso' then 110 when 'giallo' then 95 else 80 end) kv,  -- curve: agilità
                    least(case p_mode when 'rosso' then vmax * 0.82 when 'giallo' then vmax * 0.77 else vmax * 0.62 end * boost,
                          case p_mode when 'rosso' then 140 when 'giallo' then 118 else 92 end) sv          -- rettilineo: velocità massima
               from f)
  select greatest(20, (city / cv + curvy / kv + straight / sv) * 3600) from v
$function$;
select 'ESITO 10 km', m.name, round(drive_seconds(st_makepoint(10.30, 43.55)::geography, st_makepoint(10.38, 43.60)::geography, m.vmax_kmh, m.agility, 'rosso') / 60, 1) min
  from vehicle_models m where m.name in ('V-Craftor', 'M-Sprinterix', 'T-Voltara') order by 2;
select 'ESITO 150 km', m.name, round(drive_seconds(st_makepoint(10.30, 43.55)::geography, st_makepoint(11.25, 42.60)::geography, m.vmax_kmh, m.agility, 'rosso') / 60, 1) min
  from vehicle_models m where m.name in ('V-Craftor', 'M-Sprinterix', 'T-Voltara') order by 2;
select 'ESITO 400 km', m.name, round(drive_seconds(st_makepoint(10.30, 43.55)::geography, st_makepoint(13.50, 41.20)::geography, m.vmax_kmh, m.agility, 'rosso') / 60, 1) min
  from vehicle_models m where m.name in ('V-Craftor', 'M-Sprinterix', 'T-Voltara') order by 2;
