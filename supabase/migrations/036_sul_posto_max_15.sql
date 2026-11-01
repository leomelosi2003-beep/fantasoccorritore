-- Emergenze: sul posto da 10 a massimo 15 minuti
create or replace function scene_minutes(m missions) returns int
language sql volatile as $$
  select least(15,
      10 + floor(random() * 3)::int
    + case m.code when 'rosso' then 2 when 'giallo' then 1 else 0 end
    + case when m.requires && '{spinale,spinale_ped,ked,cucchiaio,collare,steccobende}'::text[] then 1 else 0 end
    + case when 'ecg' = any(m.requires) then 1 else 0 end
    + case when 'defib' = any(m.requires) then 2 else 0 end
    + case when m.title ilike '%incastr%' then 3 else 0 end
  )::int
$$;
-- anche le emergenze senza trasporto in ospedale usano lo stesso tempo sul posto
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  src := replace(src, 'make_interval(mins => case when m.event_ends_at is null then m.duration_minutes else 0 end)',
    'make_interval(mins => case when m.event_ends_at is null then (case when m.category = ''emergenza_118'' then scene_min else m.duration_minutes end) else 0 end)');
  execute src;
end $do$;
