-- Usato e aste: anche le sedi (base_auctions, base_auction_bids). Si vendono solo sedi vuote e non principali;
-- vince l'offerta più alta (la sede passa al compratore con il suo livello), senza offerte l'agenzia paga il 60%
-- del valore (8.000 € + ampliamenti) e la sede esce dal gioco (scrap_base; mission_assignments.base_id on delete set null).
-- rpc create_base_auction, place_base_bid, cancel_base_auction, base_auctions_list; cron close-base-auctions. (vedi SQL applicato)
alter table mission_assignments alter column base_id drop not null;
