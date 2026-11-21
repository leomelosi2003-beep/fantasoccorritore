-- prova di invio (tutto annullato alla fine)
do $$
declare o uuid; v uuid; m uuid; d uuid[]; a uuid[]; i uuid[]; n int;
begin
  select id into o from organizations where name ilike '%ribarb%';
  select id into v from vehicles where org_id = o and call_sign = 'India 1';
  select array_agg(ci.id) into d from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id where ci.org_id=o and ci.state='attiva' and coalesce(ci.role_override,vo.role)='autista';
  select array_agg(ci.id) into a from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id where ci.org_id=o and ci.state='attiva' and coalesce(ci.role_override,vo.role)='soccorritore_avanzato';
  select array_agg(ci.id) into i from card_inventory ci join volunteers vo on vo.id=ci.volunteer_id where ci.org_id=o and ci.state='attiva' and coalesce(ci.role_override,vo.role)='infermiere';
  raise notice 'ESITO veicolo % autisti % avanzati % infermieri %', v is not null, cardinality(d), cardinality(a), cardinality(i);
  select ms.id into m from missions ms where ms.status='aperta' and ms.required_roles = '{"autista": 1, "soccorritore_avanzato": 2}'::jsonb and coalesce(array_length(ms.requires,1),0)=0
    and now() between ms.opens_at and ms.expires_at
    and st_dwithin(ms.location, (select location from bases where id=(select base_id from vehicles where id=v)), 25000) limit 1;
  raise notice 'ESITO servizio trovato %', m is not null;
  begin perform claim_mission_as(o, m, v, array[d[1], a[1], a[2]]); raise notice 'ESITO autista+2 avanzati: OK';
  exception when others then raise notice 'ESITO autista+2 avanzati: %', sqlerrm; end;
  begin perform claim_mission_as(o, m, v, array[d[1], a[1], i[1]]); raise notice 'ESITO autista+avanzato+infermiere: OK';
  exception when others then raise notice 'ESITO autista+avanzato+infermiere: %', sqlerrm; end;
  select count(*) into n from mission_assignments where org_id=o and status='in_viaggio';
  perform auto_dispatch_org(o);
  raise notice 'ESITO automatico: in viaggio prima % dopo %', n, (select count(*) from mission_assignments where org_id=o and status='in_viaggio');
  raise exception 'ESITO fine prova (annullata)';
end $$;
