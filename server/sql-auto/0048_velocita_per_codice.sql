-- 248: velocità coerenti: il codice comanda (rosso > giallo > verde) e il modello conta più dei potenziamenti.
-- Prima il potenziamento di velocità (+12% a livello) moltiplicava anche oltre i limiti: un mezzo scarso potenziato
-- in codice verde andava più forte di un'ambulanza migliore in codice giallo.
create or replace function public.drive_seconds(a geography, b geography, p_vmax numeric, p_agi numeric, p_mode text, p_boost numeric default 1)
returns numeric language sql immutable set search_path to 'public', 'extensions' as $function$
  with k as (select greatest(0.2, st_distance(a, b) / 1000.0 * 1.3) road,
                    coalesce(p_vmax, 150) vmax, least(coalesce(p_agi, 1), 1.25) agi,
                    1 + (greatest(coalesce(p_boost, 1), 0.5) - 1) * 0.4 boost),          -- potenziamenti: effetto ridotto
       v as (select road, least(road, 3.0) city, greatest(0, road - 3.0) open,
                    least(case p_mode when 'rosso' then 50 * agi when 'giallo' then 44 * agi else 35 * agi end * boost,
                          case p_mode when 'rosso' then 62 when 'giallo' then 52 else 42 end) cv,           -- tetto in città per codice
                    least(case p_mode when 'rosso' then least(vmax * 0.80, 130) when 'giallo' then least(vmax * 0.75, 115)
                                else least(vmax * 0.65, 90) end * boost,
                          case p_mode when 'rosso' then 140 when 'giallo' then 118 else 92 end) ov           -- tetto fuori città per codice
               from k)
  select greatest(20, (city / cv + open / ov) * 3600) from v
$function$;
select 'ESITO velocità', m, round(drive_seconds(st_makepoint(10.3,43.5)::geography, st_makepoint(10.4,43.5)::geography, 150, 1, m, 1.36)) sec
  from unnest(array['rosso','giallo','verde']) m;
