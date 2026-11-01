-- CLASSIFICA: guadagni, crescita, patrimonio, reputazione. Visibile a tutti.
create table if not exists org_snapshots (
  org_id uuid not null references organizations(id) on delete cascade,
  day date not null,
  value bigint not null,
  reputation int not null,
  primary key (org_id, day)
);
alter table org_snapshots enable row level security;
drop policy if exists "read snapshots" on org_snapshots;
create policy "read snapshots" on org_snapshots for select to authenticated using (true);

-- Patrimonio = soldi in cassa + valore di mezzi, sedi e volontari
create or replace function take_org_snapshots() returns int
language sql security definer set search_path = public as $$
  with x as (
  insert into org_snapshots (org_id, day, value, reputation)
  select id, (now() at time zone 'Europe/Rome')::date, funds + org_valuation(id), reputation from organizations
  on conflict (org_id, day) do update set value = excluded.value, reputation = excluded.reputation
  returning 1) select count(*)::int from x $$;
select cron.unschedule(jobname) from cron.job where jobname = 'org-snapshots';
select cron.schedule('org-snapshots', '0 * * * *', $$select take_org_snapshots()$$);
select take_org_snapshots();

create or replace function leaderboard() returns table (
  org_id uuid, name text, type org_type, logo_url text, alliance text,
  earnings_7d bigint, services_7d bigint, wealth bigint, growth_pct numeric, reputation int)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.type, o.logo_url,
         (select a.name from alliance_members m join alliances a on a.id = m.alliance_id where m.org_id = o.id),
         coalesce((select sum(ma.reward_funds) from mission_assignments ma
                    where ma.org_id = o.id and ma.status = 'conclusa' and ma.completed_at > now() - interval '7 days'), 0)::bigint,
         (select count(*) from mission_assignments ma
           where ma.org_id = o.id and ma.status = 'conclusa' and ma.completed_at > now() - interval '7 days'),
         (o.funds + org_valuation(o.id))::bigint,
         (select round(((o.funds + org_valuation(o.id)) - s.value) * 100.0 / nullif(s.value, 0), 1)
            from org_snapshots s where s.org_id = o.id and s.day >= (now() at time zone 'Europe/Rome')::date - 7
            order by s.day limit 1),
         o.reputation
  from organizations o $$;
grant execute on function leaderboard() to authenticated;

select name, earnings_7d, wealth, reputation from leaderboard();
