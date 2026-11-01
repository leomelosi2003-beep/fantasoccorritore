-- Più ambulanze della stessa associazione sullo stesso servizio, finché ci sono posti liberi
alter table mission_assignments drop constraint if exists mission_assignments_mission_id_org_id_key;
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('più mezzi della stessa' in src) = 0 then
    src := regexp_replace(src,
      'if exists \(select 1 from mission_assignments where mission_id = m\.id and org_id = v_org\) then',
      '-- più mezzi della stessa associazione sullo stesso servizio, finché ci sono posti liberi
  if exists (select 1 from mission_assignments where mission_id = m.id and org_id = v_org and status in (''in_viaggio'', ''sul_posto''))
     and m.slots_taken >= m.slots_total then');
    execute src;
  end if;
end $do$;
