-- Potenziamento velocità di tutti i mezzi di una sede con un click.
-- p_to = livello da raggiungere (1..3). Paga livello per livello; se i soldi finiscono si ferma (prima i mezzi più indietro).
create or replace function public.upgrade_base_speed(p_base uuid, p_to int)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_org uuid := my_org_id(); v record; c int; n int := 0; tot bigint := 0; skipped int := 0; f bigint;
begin
  if v_org is null then raise exception 'NOT_FOUND'; end if;
  p_to := least(3, greatest(1, coalesce(p_to, 3)));
  if not exists (select 1 from bases where id = p_base and (org_id = v_org or collab_org = v_org)) then raise exception 'NOT_FOUND'; end if;
  perform 1 from organizations where id = v_org for update;
  select funds into f from organizations where id = v_org;
  -- un livello alla volta a tutti, così con pochi soldi si alzano prima i più lenti
  for lvl in 0..2 loop
    exit when lvl >= p_to;
    for v in select id from vehicles where org_id = v_org and base_id = p_base and speed_level = lvl order by call_sign for update loop
      c := speed_upgrade_cost(lvl);
      if f - tot < c then skipped := skipped + 1; continue; end if;
      update vehicles set speed_level = speed_level + 1 where id = v.id;
      tot := tot + c; n := n + 1;
    end loop;
  end loop;
  if n = 0 and skipped > 0 then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if tot > 0 then update organizations set funds = funds - tot where id = v_org; end if;
  return jsonb_build_object('upgrades', n, 'cost', tot, 'skipped', skipped);
end $f$;
grant execute on function public.upgrade_base_speed(uuid, int) to authenticated;
notify pgrst, 'reload schema';
select 'ESITO potenzia sede ok';
