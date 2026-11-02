-- Classifica: statistiche dell'admin nascoste (🔒), crescita % calcolata senza i soldi aggiunti a mano
create table if not exists org_adjustments (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  amount bigint not null,
  note text,
  created_at timestamptz not null default now()
);
alter table org_adjustments enable row level security;
-- (regali admin del 2/11: 200.000 € e 800.000 € registrati qui)
-- leaderboard_v2(): come leaderboard() ma con colonna hidden e valori null per l'admin; crescita al netto di org_adjustments
-- take_org_snapshots(): valore al netto di org_adjustments
-- (vedi SQL applicato)
