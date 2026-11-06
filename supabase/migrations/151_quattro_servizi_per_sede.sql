-- Più servizi per le sedi lontane (Roma, Milano, Trento...): ogni sede punta ad avere almeno 4 servizi
-- aperti entro 20 km (prima 2). Nelle zone già piene (Livorno, Pisa) non cambia nulla.

do $$
declare src text;
begin
  src := replace(pg_get_functiondef('public.generate_missions()'::regprocedure), E'\r\n', E'\n');
  if position('20000)) < 2' in src) > 0 then
    execute replace(src, '20000)) < 2', '20000)) < 4');
  end if;
  if position('20000)) < 4' in pg_get_functiondef('public.generate_missions()'::regprocedure)) = 0 then
    raise exception 'patch generate_missions fallita';
  end if;
end $$;
