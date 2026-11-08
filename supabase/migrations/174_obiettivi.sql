-- 174: Obiettivi giornalieri (3) e settimanali (2) con premio in soldi e reputazione.
-- Il progresso si calcola al volo dai servizi conclusi (indice mission_assignments_org_completed_idx),
-- quindi il tick non viene appesantito. Nessun dato esistente viene toccato.
-- Gli obiettivi si scelgono in modo fisso per giorno/settimana (uguali per tutti, tranne quelli
-- che richiedono barche/AIB/passi lunghi, mostrati solo a chi ha quei mezzi). Obiettivi e premi
-- sono proporzionati al numero di mezzi e all'incasso medio, cosi' sono giusti per piccoli e grandi.

create table if not exists public.objective_claims (
  org_id uuid not null references public.organizations(id),
  period text not null,          -- 'd:2026-11-08' oppure 'w:2026-11-02' (lunedi')
  obj_key text not null,
  reward bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (org_id, period, obj_key)
);
alter table public.objective_claims enable row level security;
drop policy if exists objective_claims_own on public.objective_claims;
create policy objective_claims_own on public.objective_claims for select
  using (org_id = public.my_org_id());

-- Progresso di una metrica in un intervallo
create or replace function public.objective_metric(p_org uuid, p_metric text, p_from timestamptz, p_to timestamptz)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(case p_metric
    when 'servizi'  then count(*)
    when 'rossi'    then count(*) filter (where m.code = 'rosso')
    when 'gialli'   then count(*) filter (where m.code = 'giallo')
    when 'manuali'  then count(*) filter (where not a.auto)
    when 'incasso'  then sum(a.reward_funds)
    when 'trasf'    then count(*) filter (where m.transport = 'trasferimento')
    when 'ordinari' then count(*) filter (where m.category = 'ordinario' and m.transport is distinct from 'trasferimento')
    when 'mare'     then count(*) filter (where m.category = 'mare')
    when 'incendi'  then count(*) filter (where m.category = 'grande_evento' and m.event_id is null and m.venue = 'AIB')
    when 'veloci'   then count(*) filter (where m.code = 'rosso' and a.arrives_at - a.assigned_at <= interval '30 seconds')
  end, 0)::bigint
  from mission_assignments a join missions m on m.id = a.mission_id
  where a.org_id = p_org and a.status = 'conclusa'
    and a.completed_at >= p_from and a.completed_at < p_to
$$;

-- Elenco obiettivi della mia associazione (giornalieri + settimanali) con progresso e premio
create or replace function public.my_objectives()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := my_org_id();
  v_now timestamp := (now() at time zone 'Europe/Rome');
  v_day date := v_now::date;
  v_week date := date_trunc('week', v_now)::date;
  d_from timestamptz := (v_day::timestamp) at time zone 'Europe/Rome';
  d_to   timestamptz := ((v_day + 1)::timestamp) at time zone 'Europe/Rome';
  w_from timestamptz := (v_week::timestamp) at time zone 'Europe/Rome';
  w_to   timestamptz := ((v_week + 7)::timestamp) at time zone 'Europe/Rome';
  v_veh int; v_avg bigint; v_unit bigint;
  has_boat boolean; has_aib boolean; has_long boolean; has_ord boolean;
  v_out jsonb := '[]'::jsonb;
  r record; v_prog bigint; v_period text; v_claimed boolean; v_target bigint; v_reward bigint;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select count(*) filter (where not coalesce(vm.boat,false)),
         bool_or(coalesce(vm.boat,false)), bool_or(coalesce(vm.aib,false)),
         bool_or(coalesce(vm.transfer_only,false)), bool_or(coalesce(vm.ordinaria,false) or v.converted_ordinaria)
    into v_veh, has_boat, has_aib, has_long, has_ord
    from vehicles v join vehicle_models vm on vm.id = v.model_id where v.org_id = v_org;
  v_veh := greatest(1, coalesce(v_veh, 1));
  -- incasso medio giornaliero degli ultimi 7 giorni -> unita' di premio (3%), tra 15.000 e 500.000
  v_avg := objective_metric(v_org, 'incasso', now() - interval '7 days', now()) / 7;
  v_unit := least(500000, greatest(15000, round(v_avg * 0.03, -3)::bigint));

  for r in
    with pool(kind, key, icon, title, metric, target, mult, req) as (values
      ('d','servizi','🚑','Concludi %s servizi','servizi', greatest(5, v_veh*6)::bigint, 1.0, null::text),
      ('d','rossi','🔴','Concludi %s codici rossi','rossi', greatest(3, v_veh*3)::bigint, 1.0, null),
      ('d','gialli','🟡','Concludi %s codici gialli','gialli', greatest(3, v_veh*2)::bigint, 1.0, null),
      ('d','manuali','🧭','Manda a mano %s mezzi (non in automatico)','manuali', 5::bigint, 1.5, null),
      ('d','incasso','💶','Incassa %s € dai servizi','incasso', greatest(30000, v_veh*120000)::bigint, 1.0, null),
      ('d','veloci','⚡','Arriva su %s codici rossi in meno di 30 secondi','veloci', greatest(2, v_veh)::bigint, 1.2, null),
      ('w','servizi','🚑','Concludi %s servizi questa settimana','servizi', greatest(30, v_veh*35)::bigint, 4.0, null),
      ('w','manuali','🧭','Manda a mano %s mezzi questa settimana','manuali', 30::bigint, 5.0, null),
      ('w','incasso','💶','Incassa %s € questa settimana','incasso', greatest(200000, v_veh*700000)::bigint, 4.0, null),
      ('w','rossi','🔴','Concludi %s codici rossi questa settimana','rossi', greatest(20, v_veh*18)::bigint, 4.0, null),
      ('w','trasf','🔁','Fai %s trasferimenti tra ospedali','trasf', 5::bigint, 5.0, 'long'),
      ('w','ordinari','🚗','Fai %s servizi ordinari / dimissioni','ordinari', greatest(10, v_veh*3)::bigint, 4.0, 'ord'),
      ('w','mare','⛵','Fai %s soccorsi in mare','mare', 5::bigint, 5.0, 'boat'),
      ('w','incendi','🔥','Intervieni %s volte sugli incendi boschivi','incendi', 3::bigint, 5.0, 'aib')
    ),
    eligible as (
      select * from pool where req is null
        or (req = 'boat' and has_boat) or (req = 'aib' and has_aib)
        or (req = 'long' and has_long) or (req = 'ord' and has_ord)
    ),
    ranked as (
      select e.*, row_number() over (partition by kind order by
        md5(case kind when 'd' then v_day::text else v_week::text end || key)) rn
      from eligible e
    )
    select * from ranked where (kind = 'd' and rn <= 3) or (kind = 'w' and rn <= 2)
    order by kind, rn
  loop
    if r.kind = 'd' then
      v_period := 'd:' || v_day; v_prog := objective_metric(v_org, r.metric, d_from, d_to);
    else
      v_period := 'w:' || v_week; v_prog := objective_metric(v_org, r.metric, w_from, w_to);
    end if;
    v_target := r.target;
    v_reward := round(v_unit * r.mult, -3)::bigint;
    v_claimed := exists (select 1 from objective_claims c where c.org_id = v_org and c.period = v_period and c.obj_key = r.key);
    v_out := v_out || jsonb_build_object(
      'kind', r.kind, 'key', r.key, 'period', v_period, 'icon', r.icon,
      'title', format(r.title, replace(to_char(v_target, 'FM999G999G999G999'), ',', '.')),
      'target', v_target, 'progress', least(v_prog, v_target), 'reward', v_reward,
      'reputation', case r.kind when 'd' then 2 else 10 end,
      'claimed', v_claimed,
      'ends_at', case r.kind when 'd' then d_to else w_to end);
  end loop;
  return v_out;
end $$;

-- Ritira il premio di un obiettivo completato
create or replace function public.claim_objective(p_period text, p_key text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); o jsonb;
begin
  if v_org is null then raise exception 'NO_ORG'; end if;
  select x into o from jsonb_array_elements(my_objectives()) x
   where x->>'period' = p_period and x->>'key' = p_key;
  if o is null then raise exception 'OBJECTIVE_NOT_FOUND'; end if;
  if (o->>'claimed')::boolean then raise exception 'ALREADY_CLAIMED'; end if;
  if (o->>'progress')::bigint < (o->>'target')::bigint then raise exception 'NOT_COMPLETED'; end if;
  insert into objective_claims(org_id, period, obj_key, reward) values (v_org, p_period, p_key, (o->>'reward')::bigint);
  perform set_config('app.money_reason', 'Obiettivo: ' || (o->>'title'), true);
  update organizations set funds = funds + (o->>'reward')::bigint,
                           reputation = reputation + (o->>'reputation')::int
   where id = v_org;
  perform set_config('app.money_reason', '', true);
  return (o->>'reward')::bigint;
end $$;

revoke all on function public.objective_metric(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.my_objectives() to authenticated;
grant execute on function public.claim_objective(text, text) to authenticated;
grant select on public.objective_claims to authenticated;
