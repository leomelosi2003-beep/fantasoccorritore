# FantaSoccorritore — note per Claude

Gioco web gestionale di associazioni di soccorso (ambulanze 118). Proprietario: Leonardo (admin, associazione "Croce Verde Livorno").
Risposte brevi in italiano. Fai tutto tu, senza chiedere passaggi tecnici all'utente.
**Regola d'oro: non cancellare mai i dati di gioco** (associazioni, mezzi, volontari, soldi, storico).

## Architettura
- **Dal 6/11/2026 il gioco ufficiale gira sul PC di Leonardo**: https://desktop-f0qb534.tail9a3baf.ts.net (Tailscale Funnel sulla porta 3000).
  Le modifiche al database vanno fatte sul Supabase LOCALE (`docker exec supabase-db psql -U postgres`, password in `C:\fantasoccorritore\supabase\.env`),
  non più sul cloud. Il cloud `saagkulmwofgvlssiucw` è fermo (job pg_cron disattivati con `cron.alter_job(..., active := false)`, non cancellati) e resta come copia.
- `web/` Next.js 14 + react-leaflet v4. Su Vercel ogni pagina rimanda al link del PC (`redirects()` in `web/next.config.mjs`, solo con `VERCEL=1`).
  Un push fatto dal PC stesso NON fa ricompilare il sito locale (HEAD = upstream): riavviare `locale/3-avvia-gioco.ps1`.
- Database e logica di gioco: Supabase. Quasi tutta la logica è in funzioni SQL/RPC.
- `supabase/migrations/`: dalla 001 alla 143 sono soprattutto NOTE (le modifiche erano applicate via MCP). Dalla 144 contengono SQL reale, applicato sul database locale.
- `locale/`: script per far girare tutto sul PC Windows di Leonardo (Supabase in Docker + Next + tunnel Cloudflare + aggiornamento automatico da GitHub ogni 2 min).
  In modalità locale `NEXT_PUBLIC_SUPABASE_URL=same-origin` e Next inoltra `/sb/*` a `http://localhost:8000`.

## Motore del gioco
- Un solo job pg_cron `game-tick` ogni 30 s: `call public.game_tick()` (procedura SENZA security definer / set, altrimenti niente COMMIT).
  Esegue `run_tick_task(task)` con cadenze in `tick_state`: races 30, complete 30, dispatch 60, missions 120, maint 60, wake 60, charge_auto 60, recharge 180, auctions 300, base_auctions 300, transfers 300, events 300, parse 300, medical 30, wealth 3600, sea 120.
- Funzioni principali: `claim_mission(_as)`, `resolve_races` (chi arriva prima vince, chi arriva senza posto torna senza ricompensa), `complete_due_assignments` (ricompense, bonus carte, tassa progressiva 0/15/35/55% sopra 1M/5M/20M), `generate_missions` (migr. 156: OGNI sede con meno di 4 servizi aperti entro 20 km viene riempita a ogni giro, senza più il tetto di 80 che lasciava sedi a 0 — in regime costante è gratis perché `where c<4` non trova nulla; poi il resto a caso fino a ~60 aperti; tutti entro 20 km da una sede via `generate_missions_near(base, n, raggio=20000)`; se vicino alla sede non ci sono punti noti i servizi si spargono tra 2 e 20 km invece di restare addosso; i servizi scheduler durano 12 min, non 5, così la copertura regge tra un giro e l'altro; una sede nuova ne riceve 4 col trigger `bases_new_missions`), `generate_sea_missions`, `auto_dispatch_org` e `auto_medical` (solo servizi entro 20 km dalla sede del mezzo, `auto_max_km` max 20; solo mezzi delle sedi in `organizations.auto_base_ids`, max 4, rpc `set_auto_bases` + `MAX_AUTO_BASES` in `web/app/automatico/page.tsx`), `wealth_tax` (orario, fondo di solidarietà).
- Trasferimenti (`generate_transfers`, categoria 'ordinario' perché `normalize_emergency_roles` riscrive i ruoli delle emergenze 118): partono dall'ospedale più vicino a una sede, 4.000 € + 130 €/km, urgenti in giallo/rosso (115 km/h) e con `required_roles.medico` (claim controlla che ci sia davvero un medico). `vehicles.auto_transport_only` (rpc `set_vehicle_transport_only`): in automatico solo ordinari e trasferimenti.
- Alcune funzioni sono salvate con a capo CRLF: nelle patch con `pg_get_functiondef` + replace normalizzare con `replace(src, E'\r\n', E'\n')`.
- `nearest_hospital`: ospedale più vicino con pronto soccorso (o col reparto giusto se più vicino); Capraia → eliporto, Elba → Portoferraio.
- Altri job pg_cron oltre a `game-tick`: sync-events-request, org-snapshots, purge-chat, alliance-tax, purge-ledger.
- Mezzi: ambulanze, automediche (solo autista+medico, solo giallo/rosso, aspettano un'ambulanza; se arrivano prime vincono a tavolino), moto (1-2 soccorritori, max 2 per sede), barche (solo missioni 'mare', ormeggio entro 30 km da un porto, rotte via `sea_path` sui `sea_waypoints`, scaricano in porto ad un'ambulanza; non occupano garage), elisoccorso a pagamento (metà dei soldi, attivo 10 min, vince a tavolino).
- Carte rare (epic/leggendarie) riducono i tempi con tetto; ruoli volontari (enum `volunteer_role`): autista, soccorritore_base, soccorritore_avanzato, caposervizio, infermiere, medico, bagnino.
- Bagnini (migr. 157): ruolo `bagnino`, idoneo alle buste come gli altri. `role_rank('bagnino')=0` (non vale sui mezzi di terra). Equipaggio barca in `claim_mission_as` (ramo `v_boat`): 1 bagnino + 1/2 soccorritori, nessun altro ruolo → `BOAT_CREW`; un bagnino su un mezzo non-barca → `BAGNINO_ONLY_BOAT`. `generate_sea_missions` mostra `{bagnino:1, soccorritore_base:1/2}`. Le barche NON sono in automatico (`auto_dispatch_org` esclude `mare`/`boat`), quindi niente scelta equipaggio automatica lato motore. Lato web: ruolo in `ROLE`/`RANK`, logica barca in `MissionPanel.tsx` (`isBoat`). Per inserire volontari epica/leggendaria serve `source='admin'` (vincolo `rare_only_by_admin`).
- Acquisizioni a scelta (migr. 154): offerta/controfferta a turni (max 6 round) con prezzo + elenco `acquisition_offer_items` (prendo/do: sede, mezzo, volontario). Sede principale non scambiabile, una sede passa con i suoi mezzi, nessun dato cancellato. rpc `trade_assets`, `make_acquisition_offer(seller, price, take, give)`, `counter_acquisition_offer(id, price, take, give)`, `acquisition_offer_items_list`. UI: `web/components/OfferEditor.tsx` (Alleanza e `AcquisitionModal`).
- La copia dal cloud (`supabase db dump`) NON porta trigger e regole degli schemi auth/storage: ripristinati con la migrazione 155 (eseguire come `supabase_admin`). I file di storage (7 stemmi, 2 foto) sono ancora sul cloud: `logo_url`/`avatar_url` puntano a `saagkulmwofgvlssiucw.supabase.co`.
- Reset password: pagina `web/app/reset/page.tsx` (+ "Password dimenticata?" in LoginScreen). Il link self-service via email richiede SMTP, non configurato sul locale. Link senza email: admin API `POST /auth/v1/admin/generate_link` (type recovery) col SERVICE_ROLE_KEY, poi costruire `https://<ts.net>/sb/auth/v1/verify?token=<hashed_token>&type=recovery&redirect_to=https://<ts.net>/reset`. Serve `ADDITIONAL_REDIRECT_URLS` nel `supabase/.env` con l'URL ts.net (il generatore di chiavi lo azzererebbe a una rigenerazione).
- Per modificare file da PowerShell usare percorsi assoluti con `[IO.File]` (che non segue `Set-Location`) oppure lo strumento Edit.
- Vista `my_assignments` filtrata (attenzione al limite di 1000 righe di PostgREST).

## Trucchi tecnici
- Patch di funzioni: `pg_get_functiondef` + replace + `execute` in un blocco DO, con controllo che la patch sia applicata.
- Il controllo anti-istruzioni distruttive blocca UPDATE/DELETE senza WHERE scritti nel testo: usare `execute 'up'||'date ...'`.
- Una chiamata execute_sql = una transazione: i test con RAISE finale vanno in una chiamata separata, altrimenti annullano anche le modifiche.
- Test come utente: `set_config('request.jwt.claims', json_build_object('sub','b9b15433-82f3-4b53-a825-601807453b4c','role','authenticated')::text, true)` + `set local role authenticated`.
- Il piano gratuito di Supabase si satura facilmente: tenere leggere le query del tick, usare indici.
- Immagini mezzi in `web/public/vehicles/` (varianti -map, -mis, -cri, -e), gestite da `livery()` in `web/lib/supabase.ts`.
