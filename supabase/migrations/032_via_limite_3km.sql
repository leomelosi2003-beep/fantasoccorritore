-- Tolto il limite di 3 km tra le proprie sedi (resta 500 m dalle sedi degli altri)
do $do$
declare src text;
begin
  src := pg_get_functiondef('build_base(text,double precision,double precision)'::regprocedure);
  src := regexp_replace(src, 'if exists \(select 1 from bases where org_id = v_org and st_dwithin\(location, pt, 3000\)\) then\s*raise exception ''TOO_CLOSE_TO_OWN_BASE''; end if;', '-- (limite di 3 km tra le proprie sedi tolto)');
  execute src;
end $do$;
