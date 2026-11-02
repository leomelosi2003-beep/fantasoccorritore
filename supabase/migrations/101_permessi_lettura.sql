-- I giocatori non potevano leggere il prezzo (403): il benzinaio mostrava 0 €. Permessi di lettura.
grant select on public.fuel_prices to authenticated, anon;
grant select on public.org_ledger to authenticated;
grant select on public.mission_steals to authenticated;
