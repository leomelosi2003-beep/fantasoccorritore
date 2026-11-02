-- Modalità automatica: opzione "precedenza ai rossi" (organizations.auto_steal_red).
-- I rossi vengono presi subito (senza il minuto di attesa) e, se già presi da altri ma nessuno è arrivato,
-- si manda il mezzo che arriverebbe prima (corsa). set_auto_mode(enabled, codes, reserve, steal_red). (vedi SQL applicato)
alter table organizations add column if not exists auto_steal_red boolean not null default false;
