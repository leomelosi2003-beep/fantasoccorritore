-- Ampliare le sedi pagando: livello fino a 10 (posti ambulanza = 2 + livello).
alter table bases drop constraint if exists bases_level_check;
alter table bases add constraint bases_level_check check (level >= 1 and level <= 10);
-- base_upgrade_cost(level): 8k,14k,22k,32k,45k,60k,80k,100k,125k; rpc upgrade_base(p_base). (vedi SQL applicato)
