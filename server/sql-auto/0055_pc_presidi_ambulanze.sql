-- alle missioni di Protezione Civile i "requires" sono moduli maxi, non presidi: non bloccano le ambulanze (manifestazione)
do $d$
declare src text; n text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'if not v_am and not v_boat and not v_aib and not v_maxi and not (m.requires <@ vehicle_provides(veh.equipment)) then',
                    'if not v_am and not v_boat and not v_aib and not v_maxi and not (m.requires <@ vehicle_provides(veh.equipment))
     and not (m.category = ''grande_evento'' and m.event_id is null and m.venue = ''PC'') then');
  if n = src then raise exception 'patch presidi PC non applicata'; end if;
  execute n;
end $d$;
select 'ESITO presidi PC', position('m.venue = ''PC'') then' in pg_get_functiondef('public.claim_mission_as'::regproc)) > 0;
