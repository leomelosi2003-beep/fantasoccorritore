-- 169: barca = 1 bagnino + 1 o 2 soccorritori (base O avanzato), niente medici.
do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  s := src;
  s := replace(s,
    'coalesce(ci.role_override, vo.role) = ''soccorritore_avanzato'') not between 1 and 2',
    'coalesce(ci.role_override, vo.role) in (''soccorritore_base'',''soccorritore_avanzato'')) not between 1 and 2');
  s := replace(s,
    'not in (''bagnino'',''soccorritore_avanzato'')) then',
    'not in (''bagnino'',''soccorritore_base'',''soccorritore_avanzato'')) then');
  if s = src then raise exception 'claim: patch barca non applicata'; end if;
  execute s;
end $$;

do $$
declare src text; s text;
begin
  src := replace(pg_get_functiondef('public.generate_sea_missions'::regproc), E'\r\n', E'\n');
  s := replace(src,
    'jsonb_build_object(''bagnino'', 1, ''soccorritore_avanzato'', 1)',
    'jsonb_build_object(''bagnino'', 1, ''soccorritore_base'', 1)');
  if s = src then raise exception 'generate_sea_missions: patch non applicata'; end if;
  execute s;
end $$;
