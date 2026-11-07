-- 161: equipaggio barca = 1 bagnino + 1 soccorritore avanzato (niente "pilota", niente base).
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  src2 := replace(src,
    '    if (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''bagnino'') < 1'||E'\n'||
    '       or (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) in (''soccorritore_base'',''soccorritore_avanzato'')) not between 1 and 2'||E'\n'||
    '       or exists (select 1 from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) not in (''bagnino'',''soccorritore_base'',''soccorritore_avanzato'')) then',
    '    if (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''bagnino'') < 1'||E'\n'||
    '       or (select count(*) from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) = ''soccorritore_avanzato'') not between 1 and 2'||E'\n'||
    '       or exists (select 1 from card_inventory ci join volunteers vo on vo.id = ci.volunteer_id where ci.id = any(p_card_ids) and coalesce(ci.role_override, vo.role) not in (''bagnino'',''soccorritore_avanzato'')) then');
  if src2 = src then raise exception 'claim_mission_as: patch barca non applicata'; end if;
  execute src2;
end $$;

-- i servizi in mare chiedono bagnino + soccorritore avanzato
do $$
declare src text; src2 text;
begin
  src := replace(pg_get_functiondef('public.generate_sea_missions'::regproc), E'\r\n', E'\n');
  src2 := replace(src,
    'jsonb_build_object(''bagnino'', 1, ''soccorritore_base'', case when random() < 0.5 then 1 else 2 end)',
    'jsonb_build_object(''bagnino'', 1, ''soccorritore_avanzato'', 1)');
  if src2 = src then raise exception 'generate_sea_missions: patch non applicata'; end if;
  execute src2;
end $$;
