-- Tempo sul posto: minimo 10-15 minuti, poi ospedale. Di più in base al tipo di servizio.
create or replace function scene_minutes(m missions) returns int
language sql volatile as $$
  select least(40,
      10 + floor(random() * 6)::int                                                   -- 10-15 min base
    + case m.code when 'rosso' then 5 when 'giallo' then 3 else 0 end                 -- gravità
    + case when m.requires && '{spinale,spinale_ped,ked,cucchiaio,collare,steccobende}'::text[] then 5 else 0 end  -- immobilizzazione
    + case when 'ecg' = any(m.requires) then 4 else 0 end                             -- tracciato ECG
    + case when 'defib' = any(m.requires) then 6 else 0 end                           -- rianimazione
    + case when m.title ilike '%incastr%' then 10 else 0 end                          -- estricazione
  )::int
$$;

do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := replace(src, 'scene_min := case m.code when ''rosso'' then 25 when ''giallo'' then 20 when ''verde'' then 15 else 10 end;',
                      'scene_min := scene_minutes(m);');
  execute src;
end $do$;

select position('scene_minutes(m)' in pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure)) > 0 as ok;
