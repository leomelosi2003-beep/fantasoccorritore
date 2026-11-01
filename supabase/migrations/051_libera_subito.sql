-- L'ambulanza uscita dal PS è subito riutilizzabile: claim_mission chiude prima i servizi finiti,
-- e le viste mostrano mezzi e volontari liberi senza aspettare il controllo del minuto.
do $do$
declare src text;
begin
  src := pg_get_functiondef('claim_mission(uuid,uuid,uuid[])'::regprocedure);
  if position('perform complete_due_assignments()' in src) = 0 then
    src := replace(src, '  if v_org is null then raise exception ''NO_ORG''; end if;',
      '  if v_org is null then raise exception ''NO_ORG''; end if;
  perform complete_due_assignments();');
    execute src;
  end if;
end $do$;
-- my_fleet: status 'disponibile' se non ha servizi ancora da finire; my_cards: state 'attiva' idem (vedi SQL applicato)
