-- Ambulanze usate all'asta: vehicle_auctions, auction_bids; create_auction / place_bid (soldi bloccati, rimborso a chi
-- viene superato, +1 minuto se offerta all'ultimo), cancel_auction (solo senza offerte), close_auctions ogni minuto:
-- vince l'offerta più alta (mezzo nella sede con più posti), altrimenti il concessionario paga il 60% del valore
-- di mercato e il mezzo esce dal gioco (scrap_vehicle; mission_assignments.vehicle_id ora on delete set null).
-- rpc auctions_list, vehicle_market_value. (vedi SQL applicato)
alter table mission_assignments alter column vehicle_id drop not null;
