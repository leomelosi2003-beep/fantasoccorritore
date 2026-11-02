-- Modalità automatica: solo servizi entro organizations.auto_max_km (default 10) dalla posizione dell'ambulanza,
-- ci va sempre l'ambulanza libera più vicina; ordine per distanza con precedenza a rossi (-3 km) e gialli (-1 km).
-- rpc set_auto_max_km(km). (vedi SQL applicato)
alter table organizations add column if not exists auto_max_km smallint not null default 10;
