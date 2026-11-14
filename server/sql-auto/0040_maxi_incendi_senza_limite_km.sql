-- 240: maxi emergenze e incendi (grande_evento senza event_id): nessun limite di distanza dalla sede
do $$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, '  if not st_dwithin(case when v_boat then v_moor else b.location end, m.location, case when v_boat then 40000 else 25000 end) then raise exception ''TOO_FAR''; end if;',
                    '  if not (m.category = ''grande_evento'' and m.event_id is null)
     and not st_dwithin(case when v_boat then v_moor else b.location end, m.location, case when v_boat then 40000 else 25000 end) then raise exception ''TOO_FAR''; end if;');
  if n = src then raise exception 'claim_mission_as: patch distanza non applicata'; end if;
  execute n;
end $$;
select 'ESITO maxi e incendi senza limite di km';
