-- Emergenze: sul posto da 5 a massimo 10 minuti
create or replace function scene_minutes(m missions) returns int
language sql volatile as $$
  select least(10,
      5 + floor(random() * 3)::int
    + case m.code when 'rosso' then 2 when 'giallo' then 1 else 0 end
    + case when m.requires && '{spinale,spinale_ped,ked,cucchiaio,collare,steccobende}'::text[] then 1 else 0 end
    + case when 'ecg' = any(m.requires) then 1 else 0 end
    + case when 'defib' = any(m.requires) then 2 else 0 end
    + case when m.title ilike '%incastr%' then 3 else 0 end
  )::int
$$;
