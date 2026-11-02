-- Durata del servizio proporzionale al percorso reale: 1/4 del tempo reale, tra 4 e 10 minuti
-- (ridotta ancora dal potenziamento velocità). Servizi vicini a sede e ospedale finiscono prima.
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := replace(src, 'and v_free - t0 > interval ''10 minutes'' * (1 - 0.12 * veh.speed_level) then',
                      'and v_free - t0 > interval ''4 minutes'' then');
  src := replace(src, 'sf := extract(epoch from interval ''1 minute'' * (8 + random() * 2) * (1 - 0.12 * veh.speed_level)) / extract(epoch from v_free - t0);',
                      '-- durata proporzionale al percorso reale (servizi vicini all''ospedale finiscono prima): 4-10 minuti
    sf := least(1, extract(epoch from interval ''1 minute'' * least(10, greatest(4, extract(epoch from v_free - t0) / 60 * 0.25))
                                     * (1 - 0.12 * veh.speed_level)) / extract(epoch from v_free - t0));');
  execute src;
end $do$;
