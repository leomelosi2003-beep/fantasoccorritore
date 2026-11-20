-- Maxi emergenze: non finiscono finché tutti i feriti non sono stati trasportati.
-- Ogni maxi ha un numero di feriti; le ambulanze sul posto li portano via (al PMA se c'è, altrimenti spola con l'ospedale).
-- Alla scadenza, se restano feriti, la maxi e i mezzi sul posto vengono prolungati di 15 minuti alla volta (max 12 ore oltre).
create table if not exists maxi_patients (
  mission_id uuid primary key references missions(id) on delete cascade,
  injured int not null,
  transported numeric not null default 0,
  orig_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table maxi_patients enable row level security;

create or replace function public.maxi_patients_tick()
returns int language plpgsql security definer set search_path = public, extensions as $$
declare m record; amb int; pma boolean; hosp_km numeric; rate numeric; mins numeric; st maxi_patients; n int := 0; new_end timestamptz;
begin
  for m in
    select mi.id, mi.location, mi.event_ends_at, mi.expires_at from missions mi
     where mi.category = 'grande_evento' and mi.event_id is null and coalesce(mi.venue, '') not in ('AIB', 'PC')
       and mi.status in ('aperta', 'completa', 'in_corso') and mi.event_ends_at is not null
  loop
    insert into maxi_patients (mission_id, injured, orig_end) values (m.id, 24 + floor(random() * 46)::int, m.event_ends_at)
      on conflict (mission_id) do nothing;
    select * into st from maxi_patients where mission_id = m.id for update;
    -- ambulanze sul posto (non mezzi maxi, PMA, automediche, moto, barche, AIB)
    select count(*) filter (where not coalesce(vm.pma, false) and not coalesce(vm.automedica, false) and not coalesce(vm.moto, false)
                              and not coalesce(vm.boat, false) and not coalesce(vm.maxi, false) and not coalesce(vm.aib, false)),
           bool_or(coalesce(vm.pma, false) or 'pma_tenda' = any(coalesce(v.equipment, '{}')))
      into amb, pma
      from mission_assignments a join vehicles v on v.id = a.vehicle_id join vehicle_models vm on vm.id = v.model_id
     where a.mission_id = m.id and a.status not in ('annullata', 'conclusa', 'rientro') and a.arrives_at <= now();
    if coalesce(pma, false) then
      rate := 1.0;                                   -- con il PMA: un ferito al minuto per ambulanza
    else
      select st_distance(h.location, m.location) / 1000 into hosp_km from hospitals h where h.id = nearest_hospital(m.location, null);
      rate := 1.0 / (2 * greatest(4, coalesce(hosp_km, 10) * 1.3 / 70 * 60) + 8);   -- spola con l'ospedale
    end if;
    mins := greatest(0, extract(epoch from now() - st.updated_at) / 60);
    update maxi_patients set transported = least(injured, transported + coalesce(amb, 0) * rate * least(mins, 10)), updated_at = now()
     where mission_id = m.id returning * into st;
    -- restano feriti e la maxi sta per finire: si prolunga (maxi e mezzi sul posto), al massimo 12 ore oltre la fine prevista
    if st.transported < st.injured and m.event_ends_at <= now() + interval '3 minutes'
       and m.event_ends_at < coalesce(st.orig_end, m.event_ends_at) + interval '12 hours' then
      new_end := greatest(m.event_ends_at, now()) + interval '15 minutes';
      execute 'up'||'date missions set event_ends_at = $1, expires_at = greatest(expires_at, $1) where id = $2' using new_end, m.id;
      execute 'up'||'date mission_assignments set completes_at = $1 where mission_id = $2 and status not in (''annullata'', ''conclusa'', ''rientro'') and completes_at < $1'
        using new_end, m.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.maxi_patients_tick() from public, anon, authenticated;

-- la scena dal vivo legge feriti e trasportati dal server
do $d$
declare src text;
begin
  src := replace(pg_get_functiondef('public.maxi_scene(uuid)'::regprocedure), E'\r\n', E'\n');
  if position('''patients''' in src) = 0 then
    src := replace(src, $$'now', now(),$$,
      $$'now', now(), 'patients', (select jsonb_build_object('injured', p.injured, 'transported', floor(p.transported)) from maxi_patients p where p.mission_id = m.id),$$);
    if position('''patients''' in src) = 0 then raise exception 'patch maxi_scene non applicata'; end if;
    execute src;
  end if;
end $d$;
select public.maxi_patients_tick();
notify pgrst, 'reload schema';
select 'ESITO maxi', count(*), coalesce(sum(injured), 0), coalesce(sum(floor(transported)), 0) from maxi_patients;
