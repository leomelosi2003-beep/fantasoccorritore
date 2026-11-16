-- trasferimenti: qualsiasi ambulanza può farli, verso qualsiasi ospedale, senza limite di km dalla sede
do $$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, '  if not (m.category = ''grande_evento'')
     and not st_dwithin(case when v_boat',
                    '  if not (m.category = ''grande_evento'' or coalesce(m.transport::text, '''') = ''trasferimento'')
     and not st_dwithin(case when v_boat');
  if n = src then raise exception 'claim_mission_as: patch distanza trasferimenti non applicata'; end if;
  execute n;
end $$;
select 'ESITO trasferimenti senza limite di km';
