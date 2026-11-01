-- Guadagni delle ambulanze prestate: registro dei bonus e vista per il pannello Mezzi
create table if not exists loan_earnings (
  id bigserial primary key,
  lender_org uuid not null references organizations(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  assignment_id uuid references mission_assignments(id) on delete set null,
  amount int not null,
  created_at timestamptz not null default now()
);
alter table loan_earnings enable row level security;
create policy "own loan earnings" on loan_earnings for select to authenticated using (lender_org = my_org_id());
grant select on loan_earnings to authenticated;
-- complete_due_assignments(): dopo il bonus 10% al proprietario inserisce la riga in loan_earnings (vedi SQL applicato)
-- view my_lent_vehicles: prestito attivo, a chi, guadagnato da inizio prestito, servizio in corso dell'alleato
