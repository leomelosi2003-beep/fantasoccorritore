-- 186: dove la barca porta il paziente.
-- Prima: sempre il porto piu' vicino al punto in mare, anche Capraia o Gorgona (niente ospedale,
-- e nessuna ambulanza puo' arrivarci). Ora:
--  - mai sulle isole senza ospedale (Capraia, Gorgona: can_unload = false)
--  - sulle isole con ospedale (Elba) solo se l'associazione ha una sede sull'isola (entro 25 km dal porto),
--    altrimenti nessuna sua ambulanza potrebbe raggiungerla
--  - altrimenti il porto della costa piu' vicino.

alter table public.ports add column if not exists island text;
alter table public.ports add column if not exists can_unload boolean not null default true;
update public.ports set island = 'Capraia', can_unload = false where id = 11 and island is null;
update public.ports set island = 'Gorgona', can_unload = false where id = 12 and island is null;
update public.ports set island = 'Elba' where id in (8, 9, 10) and island is null;

do $$
declare src text;
  old_q text := 'select * into v_port from ports order by st_distance(location, m.location) limit 1;';
  new_q text := 'select * into v_port from ports p where p.can_unload and (p.island is null or exists (select 1 from bases bb where bb.org_id = v_org and st_dwithin(bb.location, p.location, 25000))) order by st_distance(p.location, m.location) limit 1;';
begin
  src := replace(pg_get_functiondef('public.claim_mission_as'::regproc), E'\r\n', E'\n');
  if position(new_q in src) = 0 then
    if position(old_q in src) = 0 then raise exception 'claim_mission_as: scelta del porto non trovata'; end if;
    execute replace(src, old_q, new_q);
  end if;
end $$;
