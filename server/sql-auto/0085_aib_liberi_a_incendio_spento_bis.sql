-- Incendio spento: i mezzi rientrano in sede ma sono subito disponibili (riattivabili dalla strada), come le ambulanze.
do $$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.spread_wildfires()'::regprocedure), E'\r\n', E'\n');
  n := replace(src, 'completes_at = now() + make_interval(secs => aib_leg_seconds(vehicle_position(a.vehicle_id, b.location), b.location, 250))',
                    'completes_at = now()   -- libero subito: rientra ma si può riattivare');
  if n = src then raise exception 'spread_wildfires: riga non trovata'; end if;
  execute n;
end $$;
do $$
declare k int;
begin
  execute 'up'||'date mission_assignments ma set completes_at = now()
     from missions m where m.id = ma.mission_id and m.venue = ''AIB'' and ma.status in (''in_viaggio'',''sul_posto'')
       and ma.route->0->>''label'' = ''Rientro'' and ma.completes_at > now()';
  get diagnostics k = row_count;
  raise notice 'ESITO mezzi AIB in rientro liberati: %', k;
end $$;
