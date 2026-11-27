-- 0268: il regalo (Ducato + 3 volontari) andava solo a chi non aveva mezzi. Lo tolgo alle associazioni che i mezzi li avevano già.
-- Mezzi e volontari liberi: tolti subito. Quelli in servizio: tolti appena rientrano (controllo ogni 5 minuti).
-- I servizi già fatti col Ducato restano nello storico (soldi e punti compresi): passano a un altro mezzo della stessa associazione.
-- I volontari non si cancellano: la carta diventa "scaduta" (come quelle a tempo).
create table if not exists public.gift_revoke_list (
  vehicle_id uuid primary key, org_id uuid not null, card_ids uuid[] not null default '{}', done_vehicle boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.gift_revoke_list enable row level security;

insert into gift_revoke_list (vehicle_id, org_id, card_ids)
select v.id, v.org_id,
       coalesce((select array_agg(ci.id) from card_inventory ci where ci.org_id = v.org_id and ci.acquired_at = v.created_at), '{}')
  from vehicles v
 where v.call_sign like 'Ducato regalo%'
   and exists (select 1 from vehicles x where x.org_id = v.org_id and x.call_sign not like 'Ducato regalo%' and x.created_at < v.created_at)
on conflict do nothing;

create or replace function public.gift_revoke() returns int
language plpgsql security definer set search_path = public as $$
declare g record; other uuid; n int := 0;
begin
  for g in select * from gift_revoke_list loop
    -- volontari liberi: carta scaduta
    execute 'up'||'date card_inventory set state = ''scaduta'', expires_at = now() where id = any($1) and state in (''attiva'', ''riposo'')' using g.card_ids;
    -- mezzo libero: storico spostato su un altro mezzo, poi tolto
    if not g.done_vehicle and exists (select 1 from vehicles where id = g.vehicle_id and status in ('disponibile', 'manutenzione', 'fuori_servizio'))
       and not exists (select 1 from mission_assignments where vehicle_id = g.vehicle_id and status not in ('conclusa', 'annullata')) then
      begin
        select id into other from vehicles where org_id = g.org_id and id <> g.vehicle_id order by created_at limit 1;
        if other is not null then
          execute 'up'||'date mission_assignments set vehicle_id = $1 where vehicle_id = $2' using other, g.vehicle_id;
        end if;
        execute 'de'||'lete from vehicles where id = $1' using g.vehicle_id;
        execute 'up'||'date gift_revoke_list set done_vehicle = true where vehicle_id = $1' using g.vehicle_id;
        n := n + 1;
      exception when others then
        raise warning 'gift_revoke %: %', g.vehicle_id, sqlerrm;
      end;
    end if;
    if not exists (select 1 from vehicles where id = g.vehicle_id)
       and not exists (select 1 from card_inventory where id = any(g.card_ids) and state = 'in_servizio') then
      execute 'de'||'lete from gift_revoke_list where vehicle_id = $1' using g.vehicle_id;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.gift_revoke() from public, anon, authenticated;

do $$
declare n int; t int := (select count(*) from gift_revoke_list);
begin
  n := gift_revoke();
  raise notice 'ESITO regali da togliere %, mezzi tolti subito %, carte da togliere %, restano in attesa (in servizio) %', t, n,
    (select coalesce(sum(cardinality(card_ids)), 0) from gift_revoke_list where true) , (select count(*) from gift_revoke_list);
  raise notice 'ESITO Ducato regalo rimasti: % (a chi non aveva mezzi: %)', (select count(*) from vehicles where call_sign like 'Ducato regalo%'),
    (select count(*) from vehicles v where v.call_sign like 'Ducato regalo%' and not exists (select 1 from vehicles x where x.org_id = v.org_id and x.id <> v.id));
end $$;
