-- Protezione Civile «Supporto a una manifestazione pubblica»: oltre ai mezzi maxi servono N ambulanze in postazione.
do $d$
declare src text; n text;
begin
  -- invio: le ambulanze normali possono andare alle manifestazioni; il modulo si controlla solo sui mezzi maxi
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  n := replace(src, 'if not v_maxi then raise exception ''PC_NEEDS_MAXI''; end if;',
                    'if not v_maxi and m.title not ilike ''%manifestazione%'' then raise exception ''PC_NEEDS_MAXI''; end if;');
  n := replace(n, '    if coalesce(array_length(m.requires, 1), 0) > 0
       and not exists (select 1 from equipment e where e.code = any(veh.equipment) and e.provides && m.requires::text[]) then raise exception ''PC_NEEDS_MODULE''; end if;',
                  '    if v_maxi and coalesce(array_length(m.requires, 1), 0) > 0
       and not exists (select 1 from equipment e where e.code = any(veh.equipment) and e.provides && m.requires::text[]) then raise exception ''PC_NEEDS_MODULE''; end if;');
  if position('%manifestazione%' in n) = 0 or position('if v_maxi and coalesce(array_length(m.requires' in n) = 0 then
    raise exception 'claim_mission_as: patch PC non applicata';
  end if;
  -- i moduli richiesti non sono presidi: alle missioni PC non si controllano come presidi dell'ambulanza
  n := replace(n, 'if not (m.requires <@ vehicle_provides(veh.equipment)) then',
                  'if not (m.requires <@ vehicle_provides(veh.equipment)) and not (m.category = ''grande_evento'' and m.event_id is null and m.venue = ''PC'') then');
  execute n;
  raise notice 'ESITO claim presidi PC saltati: %', position('m.venue = ''PC'') then' in n) > 0;

  -- nuove manifestazioni: da 3 a 5 ambulanze richieste, scritte nella descrizione
  src := replace(pg_get_functiondef('public.spawn_pc_mission'::regproc), E'\r\n', E'\n');
  if position('ambulanze in postazione' in src) = 0 then
    n := replace(src, '  returning id into mid;
  return mid;', '  returning id into mid;
  if sc.kind = ''evento'' then
    declare amb int := 3 + floor(random() * 3)::int;
    begin
      execute ''up''||''date missions set slots_total = $1 + 4, description = description || $2 where id = $3''
        using amb, '' Servono '' || amb || '' ambulanze in postazione per l''''assistenza sanitaria (vanno anche le ambulanze normali).'', mid;
    end;
  end if;
  return mid;');
    if n = src then raise exception 'spawn_pc_mission non patchata'; end if;
    execute n;
  end if;
end $d$;
-- manifestazioni già aperte
do $d$ begin
  execute 'up'||'date missions set slots_total = 4 + 4, description = description || '' Servono 4 ambulanze in postazione per l''''assistenza sanitaria (vanno anche le ambulanze normali).'' where venue = ''PC'' and title ilike ''%manifestazione%'' and status in (''aperta'',''in_corso'') and description not like ''%ambulanze in postazione%''';
end $d$;
notify pgrst, 'reload schema';
select 'ESITO manifestazione', position('ambulanze in postazione' in pg_get_functiondef('public.spawn_pc_mission'::regproc)) > 0,
       (select count(*) from missions where venue = 'PC' and title ilike '%manifestazione%' and status in ('aperta','in_corso'));
