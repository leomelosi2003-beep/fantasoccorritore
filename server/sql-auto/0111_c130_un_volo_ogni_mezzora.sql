-- C-130H: i voli partono a orari fissi (ogni mezz'ora), così i mezzi che arrivano in aeroporto vicini salgono sullo stesso aereo.
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.airlift_leg(geography, geography, timestamptz, numeric, numeric, numeric, text, text)'::regprocedure), E'\r\n', E'\n');
  if position('/ 1800' in src) = 0 then
    src := replace(src, $$t_off := t_in + interval '40 minutes';$$,
                        $$t_off := to_timestamp(ceil(extract(epoch from t_in + interval '40 minutes') / 1800) * 1800);   -- un volo ogni mezz'ora$$);
    if position('/ 1800' in src) = 0 then raise exception 'patch airlift_leg non applicata'; end if;
    execute src;
  end if;
end $d$;
select 'ESITO voli', position('/ 1800' in pg_get_functiondef('public.airlift_leg(geography, geography, timestamptz, numeric, numeric, numeric, text, text)'::regprocedure)) > 0;
