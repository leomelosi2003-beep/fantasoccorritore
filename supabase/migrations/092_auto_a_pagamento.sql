-- Modalità automatica a pagamento: 500 €/ora (auto_paid_until; charge_auto_mode ogni minuto, senza soldi si spegne).
-- Ricarica automatica dei volontari (organizations.auto_refill): 2.000 € a volontario, solo quanti servono per le ambulanze libere.
-- Flag app.in_auto per non far ripartire il trigger durante la modalità automatica. (vedi SQL applicato)
alter table organizations add column if not exists auto_refill boolean not null default false;
alter table organizations add column if not exists auto_paid_until timestamptz;
