-- 165: mezzi antincendio un po' piu' veloci (+0.10 al fattore velocita')
update vehicle_models set speed_factor = round(speed_factor + 0.10, 2) where aib;
