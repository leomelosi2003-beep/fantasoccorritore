-- Nuovo modulo maxi: pompa idrovora per svuotare strade e scantinati allagati.
insert into equipment (code, slot, name, cost, provides, effects, description, image_url, sort, category) values
  ('pompa_idrovora', 'maxi_pompa', 'Pompa idrovora', 65000, '{pompa}', '{"maxi_bonus":0.25}',
   'Motopompa ad alta portata con manichette: toglie l''acqua da strade, scantinati e sottopassi allagati. Serve negli allagamenti della Protezione Civile. +25% sulla maxi.', null, 5, 'maxi')
on conflict (code) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost, provides = excluded.provides,
  effects = excluded.effects, description = excluded.description, sort = excluded.sort, category = excluded.category;

-- gli allagamenti accettano la pompa (oltre a logistica e droni), anche quelli già aperti
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.pc_scenario'::regproc), E'\r\n', E'\n');
  if position('{pompa,logistica,droni}' in src) = 0 then
    src := replace(src, $$isolate.', '{logistica,droni}'$$, $$isolate.', '{pompa,logistica,droni}'$$);
    if position('{pompa,logistica,droni}' in src) = 0 then raise exception 'patch pc_scenario non applicata'; end if;
    execute src;
  end if;
end $d$;
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.spawn_pc_mission'::regproc), E'\r\n', E'\n');
  if position('pompa idrovora' in src) = 0 then
    src := replace(src, $$when 'pma' then '⛺ PMA' end$$, $$when 'pma' then '⛺ PMA' when 'pompa' then '💧 pompa idrovora' end$$);
    if position('pompa idrovora' in src) = 0 then raise exception 'patch spawn_pc_mission non applicata'; end if;
    execute src;
  end if;
end $d$;
do $d$ begin
  execute 'up'||'date missions set description = replace(description, ''moduli: '', ''moduli: 💧 pompa idrovora o '') where venue = ''PC'' and title ilike ''%allagat%'' and status in (''aperta'',''in_corso'') and description not like ''%pompa idrovora%''';
  execute 'up'||'date missions set requires = array_append(requires, ''pompa'') where venue = ''PC'' and title ilike ''%allagat%'' and status in (''aperta'',''in_corso'') and not (''pompa'' = any(requires))';
end $d$;
notify pgrst, 'reload schema';
select 'ESITO pompa', (select name from equipment where code = 'pompa_idrovora'), position('{pompa,logistica,droni}' in pg_get_functiondef('public.pc_scenario'::regproc)) > 0;
