-- In ospedale si resta solo 5 minuti, poi l'ambulanza è libera e rientra
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  -- trasferimenti: ospedale di partenza e di arrivo
  src := replace(src, 't2 := t1 + interval ''15 minutes'';', 't2 := t1 + interval ''5 minutes'';');
  src := replace(src, 't4 := t3 + interval ''15 minutes'';', 't4 := t3 + interval ''5 minutes'';');
  -- dimissioni: presa del paziente in ospedale
  src := replace(src, 't2 := t1 + interval ''10 minutes'';', 't2 := t1 + interval ''5 minutes'';');
  -- pronto soccorso e dialisi
  src := replace(src, 't4 := t3 + case when m.transport = ''dialisi'' then interval ''10 minutes'' else interval ''15 minutes'' end;',
                      't4 := t3 + interval ''5 minutes'';');
  execute src;
end $do$;
select (length(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure))
      - length(replace(pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure), 'interval ''5 minutes''', ''))) / 20 as soste_5min,
       position('15 minutes' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) = 0 as niente_15;
