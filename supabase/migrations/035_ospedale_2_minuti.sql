-- Pronto soccorso e dialisi: sosta in ospedale di 2 minuti (trasferimenti e dimissioni restano 5)
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := regexp_replace(src, 't4 := t3 \+ interval ''5 minutes'';(\s*t5 := t4 \+ make_interval\(secs => leg_minutes\(h\.location, b\.location)',
                        't4 := t3 + interval ''2 minutes'';\1');
  execute src;
end $do$;
