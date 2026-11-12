-- 202 (12/11/2026): la reputazione porta DONAZIONI DEI CITTADINI ogni mattina.
-- importo = 1.500 x radice(reputazione), arrotondato a 100 €, max 1.000.000 (servono almeno 10 ⭐). La reputazione non si consuma.
create or replace function public.citizen_donation_amount(p_rep numeric) returns int language sql immutable as $$
  select least(1000000, round(1500 * sqrt(greatest(coalesce(p_rep, 0), 0)) / 100) * 100)::int
$$;
create table if not exists public.org_donations (
  org_id uuid not null references public.organizations(id) on delete cascade,
  day date not null, amount int not null, reputation numeric not null, paid_at timestamptz not null default now(),
  primary key (org_id, day));
-- pay_citizen_donations(): una volta al giorno per associazione (on conflict), money_reason 'Donazioni dei cittadini'.
-- my_donation_info(): {today, next, week, reputation} per la scheda "Andamento" in alto (GameMap) + avviso del mattino.
-- cron 'citizen-donations' = '5 7 * * *' (UTC: 08:05 d'inverno, 09:05 d'estate).
-- (corpi completi delle funzioni: applicati via MCP, vedi pg_get_functiondef)
