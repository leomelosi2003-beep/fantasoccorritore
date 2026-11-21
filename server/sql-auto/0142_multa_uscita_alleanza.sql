-- Chi esce dall'alleanza paga una multa a ogni membro che resta
create or replace function public.alliance_leave_fine_each() returns bigint language sql immutable as $$ select 25000::bigint $$;

create or replace function public.my_alliance_leave_fine() returns table(each bigint, members int, total bigint)
 language sql stable security definer set search_path to 'public' as $$
  select alliance_leave_fine_each(), count(*)::int, alliance_leave_fine_each() * count(*)
    from alliance_members where alliance_id = my_alliance() and org_id <> my_org_id()
$$;
grant execute on function public.my_alliance_leave_fine() to authenticated;

create or replace function public.leave_alliance()
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid := my_org_id(); al uuid := my_alliance(); n int; fine bigint := alliance_leave_fine_each();
begin
  if al is null then return; end if;
  select count(*) into n from alliance_members where alliance_id = al and org_id <> v_org;
  if n > 0 then
    perform 1 from organizations where id = v_org for update;
    perform set_config('app.money_reason', 'Multa per uscita dall''alleanza', true);
    execute 'up'||'date organizations set funds = funds - $1 where id = $2 and funds >= $1' using fine * n, v_org;
    if not found then raise exception 'LEAVE_FINE_FUNDS:%', fine * n; end if;
    perform set_config('app.money_reason', 'Multa pagata da chi è uscito dall''alleanza', true);
    execute 'up'||'date organizations set funds = funds + $1 where id in (select org_id from alliance_members where alliance_id = $2 and org_id <> $3)' using fine, al, v_org;
    perform set_config('app.money_reason', '', true);
  end if;
  execute 'up'||'date vehicle_loans set returned_at = now() where returned_at is null and $1 in (from_org, to_org)' using v_org;
  execute 'up'||'date card_loans set returned_at = now() where returned_at is null and $1 in (from_org, to_org)' using v_org;
  execute 'de'||'lete from alliance_members where org_id = $1' using v_org;
  if not exists (select 1 from alliance_members where alliance_id = al) then execute 'de'||'lete from alliances where id = $1' using al; end if;
end $function$;
do $$ begin raise notice 'ESITO multa uscita alleanza attiva'; end $$;
