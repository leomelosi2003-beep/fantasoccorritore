-- 178: Gioco di squadra nelle alleanze.
-- 1) Obiettivo settimanale di alleanza: i punti (come in stagione) di tutti i membri si sommano.
--    Tre traguardi: bronzo 50%, argento 100%, oro 150% del bersaglio (400 punti a mezzo, minimo 1000 a membro).
--    Ogni membro ritira il premio di ogni traguardo raggiunto: 100.000 / 250.000 / 500.000 €.
-- 2) Maxi-emergenze e incendi: se sul posto ci sono mezzi di almeno 3 associazioni della stessa alleanza,
--    ognuna di loro prende +25% sul premio.

create or replace function public.org_points(p_org uuid, p_from timestamptz, p_to timestamptz)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(case
           when m.category = 'grande_evento' and m.event_id is null then 5
           when m.code = 'rosso' then 3 when m.code = 'giallo' then 2 else 1 end), 0)::bigint
       + coalesce((select count(*) * 20 from objective_claims c
                    where c.org_id = p_org and c.claimed_at >= p_from and c.claimed_at < p_to), 0)
    from mission_assignments a join missions m on m.id = a.mission_id
   where a.org_id = p_org and a.status = 'conclusa' and not a.support
     and a.completed_at >= p_from and a.completed_at < p_to
$$;
revoke all on function public.org_points(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create table if not exists public.alliance_goal_claims (
  org_id uuid not null references public.organizations(id),
  week date not null,
  tier smallint not null,          -- 1 bronzo, 2 argento, 3 oro
  alliance_id uuid not null,
  reward bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (org_id, week, tier)
);
alter table public.alliance_goal_claims enable row level security;
drop policy if exists alliance_goal_claims_own on public.alliance_goal_claims;
create policy alliance_goal_claims_own on public.alliance_goal_claims for select using (org_id = public.my_org_id());
grant select on public.alliance_goal_claims to authenticated;

create or replace function public.my_alliance_goal()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := my_org_id(); v_all uuid; v_name text;
  v_week date := date_trunc('week', now() at time zone 'Europe/Rome')::date;
  f timestamptz := v_week::timestamp at time zone 'Europe/Rome';
  t timestamptz := (v_week + 7)::timestamp at time zone 'Europe/Rome';
  v_target bigint; v_members jsonb; v_total bigint;
begin
  select am.alliance_id, al.name into v_all, v_name
    from alliance_members am join alliances al on al.id = am.alliance_id where am.org_id = v_org;
  if v_all is null then return null; end if;
  select sum(greatest(1000, (select count(*) from vehicles v where v.org_id = am.org_id) * 400)),
         jsonb_agg(jsonb_build_object('org_id', o.id, 'name', o.name, 'logo_url', o.logo_url, 'type', o.type,
                                      'points', org_points(o.id, f, t)) order by o.name)
    into v_target, v_members
    from alliance_members am join organizations o on o.id = am.org_id where am.alliance_id = v_all;
  select coalesce(sum((x->>'points')::bigint), 0) into v_total from jsonb_array_elements(v_members) x;
  return jsonb_build_object(
    'alliance', v_name, 'week', v_week, 'ends_at', t, 'total', v_total, 'target', v_target,
    'members', v_members,
    'tiers', jsonb_build_array(
      jsonb_build_object('tier', 1, 'label', 'Bronzo', 'icon', '🥉', 'need', ceil(v_target * 0.5), 'reward', 100000),
      jsonb_build_object('tier', 2, 'label', 'Argento', 'icon', '🥈', 'need', v_target, 'reward', 250000),
      jsonb_build_object('tier', 3, 'label', 'Oro', 'icon', '🥇', 'need', ceil(v_target * 1.5), 'reward', 500000)),
    'claimed', coalesce((select jsonb_agg(tier) from alliance_goal_claims c where c.org_id = v_org and c.week = v_week), '[]'::jsonb));
end $$;
grant execute on function public.my_alliance_goal() to authenticated;

create or replace function public.claim_alliance_goal(p_tier int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_org uuid := my_org_id(); g jsonb; tr jsonb; v_all uuid;
begin
  g := my_alliance_goal();
  if g is null then raise exception 'NO_ALLIANCE'; end if;
  select x into tr from jsonb_array_elements(g->'tiers') x where (x->>'tier')::int = p_tier;
  if tr is null then raise exception 'BAD_TIER'; end if;
  if (g->>'total')::bigint < (tr->>'need')::bigint then raise exception 'NOT_COMPLETED'; end if;
  select alliance_id into v_all from alliance_members where org_id = v_org;
  insert into alliance_goal_claims(org_id, week, tier, alliance_id, reward)
  values (v_org, (g->>'week')::date, p_tier, v_all, (tr->>'reward')::bigint);   -- PK impedisce il doppio ritiro
  perform set_config('app.money_reason', 'Obiettivo di alleanza: ' || (tr->>'label'), true);
  update organizations set funds = funds + (tr->>'reward')::bigint where id = v_org;
  perform set_config('app.money_reason', '', true);
  return (tr->>'reward')::bigint;
end $$;
grant execute on function public.claim_alliance_goal(int) to authenticated;

-- Bonus squadra su maxi-emergenze e incendi
do $$
declare src text;
  anchor text := E'    perform set_config(''app.money_reason'', ''Servizi'', true);';
begin
  src := replace(pg_get_functiondef('public.complete_due_assignments'::regproc), E'\r\n', E'\n');
  if position('bonus squadra' in src) = 0 then
    if position(anchor in src) = 0 then raise exception 'ancora non trovata'; end if;
    src := replace(src, anchor,
      E'    -- bonus squadra: almeno 3 associazioni della mia alleanza su questa maxi/incendio -> +25%\n' ||
      E'    if m.category = ''grande_evento'' and m.event_id is null and (\n' ||
      E'         select count(distinct x.org_id) from mission_assignments x\n' ||
      E'           join alliance_members xm on xm.org_id = x.org_id\n' ||
      E'          where x.mission_id = m.id and x.status <> ''annullata''\n' ||
      E'            and xm.alliance_id = (select alliance_id from alliance_members where org_id = a.org_id)) >= 3 then\n' ||
      E'      reward := round(reward * 1.25);\n' ||
      E'    end if;\n' || anchor);
    execute src;
  end if;
end $$;
