-- Corso autisti anche per i soccorritori avanzati: un base diventa autista base, un avanzato diventa autista avanzato
do $$
declare src text; new_src text; d text; nd text;
begin
  -- 1) il corso accetta anche gli avanzati (solo per diventare autisti)
  src := replace(pg_get_functiondef('training_class'::regproc), E'\r\n', E'\n');
  new_src := replace(src, $a$and coalesce(ci.role_override, v.role) = 'soccorritore_base'$a$,
    $a$and (coalesce(ci.role_override, v.role) = 'soccorritore_base' or (p_target = 'autista' and coalesce(ci.role_override, v.role) = 'soccorritore_avanzato'))$a$);
  if new_src = src then raise exception 'ESITO patch corso non applicata'; end if;
  execute new_src;
  -- 2) invio dei mezzi: un autista che era soccorritore avanzato vale come autista avanzato
  src := replace(pg_get_functiondef('claim_mission_as'::regproc), E'\r\n', E'\n');
  new_src := replace(src, 'vo.avanzato as vol_avanzato', $a$(vo.avanzato or vo.role in ('soccorritore_avanzato', 'caposervizio')) as vol_avanzato$a$);
  if new_src = src then raise exception 'ESITO patch invio non applicata'; end if;
  execute new_src;
  -- 3) le carte nel sito (squadra, pannello invio)
  d := pg_get_viewdef('my_cards'::regclass, true);
  nd := regexp_replace(d, '(\s)v\.avanzato(,|\s)', $a$\1(v.avanzato OR v.role = ANY (ARRAY['soccorritore_avanzato'::volunteer_role, 'caposervizio'::volunteer_role])) AS avanzato\2$a$);
  if nd = d then raise exception 'ESITO patch carte non applicata'; end if;
  execute 'create or replace view public.my_cards as ' || nd;
  raise notice 'ESITO corso autisti per avanzati attivo';
end $$;
-- controllo: l'automatico usa lo stesso dato?
do $$ begin
  raise notice 'ESITO automatico usa avanzato: %', position('avanzato' in pg_get_functiondef('auto_dispatch_org'::regproc)) > 0;
end $$;
