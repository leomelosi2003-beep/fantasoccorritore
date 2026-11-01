-- Una nuova sede deve stare ad almeno 500 m dalle sedi delle altre associazioni
do $do$
declare src text;
begin
  src := pg_get_functiondef('build_base(text,double precision,double precision)'::regprocedure);
  if position('TOO_CLOSE_TO_OTHER_BASE' in src) = 0 then
    src := replace(src, 'raise exception ''TOO_CLOSE_TO_OWN_BASE''; end if;',
      'raise exception ''TOO_CLOSE_TO_OWN_BASE''; end if;
  -- almeno 500 m dalle sedi delle altre associazioni
  if exists (select 1 from bases where org_id <> v_org and st_dwithin(location, pt, 500)) then
    raise exception ''TOO_CLOSE_TO_OTHER_BASE''; end if;');
    execute src;
  end if;
end $do$;
