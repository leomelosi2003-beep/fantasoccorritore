-- Più ambulanze della stessa associazione sullo stesso servizio, anche oltre i posti (max 5): mezzi di supporto.
-- mission_assignments.support (bool); claim_mission: se pieno e ho già un mezzo -> support, slot extra, non conta in slots_taken.
-- complete_due_assignments: supporto = metà premio. resolve_races: supporti annullati solo se la loro associazione perde la corsa.
-- Blocco "due mezzi" solo per codice rosso. missions_map.my_vehicles. (vedi SQL applicato)
alter table mission_assignments add column if not exists support boolean not null default false;
