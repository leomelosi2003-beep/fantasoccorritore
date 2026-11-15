-- 244: i mezzi di terra non attraversano il mare: da Piombino (o da qualsiasi sede sul continente) niente servizi all'Elba
-- e nelle altre isole, e viceversa. Le barche restano libere; maxi e incendi restano raggiungibili da ovunque.
create or replace function public.island_of(p geography) returns text
language sql immutable parallel safe as $f$
  select case
    when x between 10.08 and 10.45 and y between 42.70 and 42.89 then 'elba'
    when x between 9.77 and 9.86 and y between 43.00 and 43.08 then 'capraia'
    when x between 9.87 and 9.93 and y between 43.41 and 43.45 then 'gorgona'
    when x between 10.06 and 10.12 and y between 42.56 and 42.61 then 'pianosa'
    when x between 10.28 and 10.34 and y between 42.31 and 42.36 then 'montecristo'
    when x between 10.85 and 10.95 and y between 42.30 and 42.40 then 'giglio'
    when x between 11.08 and 11.12 and y between 42.23 and 42.27 then 'giannutri'
    when x between 13.84 and 13.97 and y between 40.69 and 40.78 then 'ischia'
    when x between 13.99 and 14.05 and y between 40.74 and 40.78 then 'procida'
    when x between 14.18 and 14.28 and y between 40.53 and 40.57 then 'capri'
    when x between 8.10 and 9.85 and y between 38.85 and 41.32 then 'sardegna'
    when x between 12.30 and 15.60 and y between 36.60 and 38.32 then 'sicilia'
  end
  from (select st_x(p::geometry) x, st_y(p::geometry) y) c
$f$;

do $$
declare src text; n text;
begin
  -- invio a mano
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'then 40000 else 25000 end) then raise exception ''TOO_FAR''; end if;',
                    'then 40000 else 25000 end) then raise exception ''TOO_FAR''; end if;
  if not v_boat and not (m.category = ''grande_evento'' and m.event_id is null)
     and island_of(b.location) is distinct from island_of(m.location) then raise exception ''ISLAND''; end if;');
  if n = src then raise exception 'claim_mission_as non patchata'; end if;
  execute n;
  -- automatico
  src := replace(pg_get_functiondef('public.auto_dispatch_org'::regproc), E'\r\n', E'\n');
  n := replace(src, 'st_dwithin(v.bloc, mm.location, 20000)', 'st_dwithin(v.bloc, mm.location, 20000) and island_of(v.bloc) is not distinct from island_of(mm.location)');
  n := replace(n, 'st_dwithin(f.bloc, mm.location, 20000)', 'st_dwithin(f.bloc, mm.location, 20000) and island_of(f.bloc) is not distinct from island_of(mm.location)');
  if n = src then raise exception 'auto_dispatch_org non patchata'; end if;
  execute n;
  src := replace(pg_get_functiondef('public.auto_medical'::regproc), E'\r\n', E'\n');
  n := replace(src, 'st_dwithin(b.location, m.location, 20000)', 'st_dwithin(b.location, m.location, 20000) and island_of(b.location) is not distinct from island_of(m.location)');
  n := replace(n, 'st_dwithin(v.bloc, mm.location, 20000)', 'st_dwithin(v.bloc, mm.location, 20000) and island_of(v.bloc) is not distinct from island_of(mm.location)');
  if n = src then raise exception 'auto_medical non patchata'; end if;
  execute n;
end $$;
select 'ESITO isole', b.name, island_of(b.location) from bases b
 where st_x(b.location::geometry) between 10.0 and 10.6 and st_y(b.location::geometry) between 42.6 and 43.0 order by 3 nulls first;
