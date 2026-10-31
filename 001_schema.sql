# FantaSoccorritore

Versione 100% gratuita: nessun server da pagare.

| Cartella             | Cosa fa                                    | Dove gira                  |
|----------------------|--------------------------------------------|----------------------------|
| `web/`               | App Next.js (mappa, sedi, garage, deck)    | Vercel (piano Hobby)       |
| `supabase/`          | Database, logica di gioco, generatore servizi, realtime | Supabase (piano Free) |
| `worker/` + `.github/workflows/` | Carte settimanali generate dall'AI | GitHub Actions          |

```
GitHub (push su main) ──► Vercel: deploy automatico di web/
GitHub Actions (lunedì) ──► crea le carte nuove in Supabase
Supabase pg_cron (ogni minuto / 5 minuti) ──► servizi, riposi, scadenze
```

## 1. Supabase
1. Crea un progetto su supabase.com (regione europea).
2. Database → Extensions: abilita **postgis** e **pg_cron**.
3. SQL Editor: esegui in ordine `001_schema.sql`, `002_map_views.sql`, `003_generate_missions.sql`.
4. Project Settings → API: copia **Project URL**, **anon key** e **service_role key**.

## 2. GitHub
```bash
cd fantasoccorritore
git init
git add .
git commit -m "Prima versione"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/fantasoccorritore.git
git push -u origin main
```
Poi nel repo: **Settings → Secrets and variables → Actions → New repository secret**
e aggiungi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

## 3. Vercel (frontend)
1. vercel.com → Add New → Project → importa il repo.
2. **Root Directory: `web`**.
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.

## 4. Prova
- Dopo 5 minuti in Supabase → Table Editor → `missions` compaiono i primi servizi.
- GitHub → Actions → "Carte settimanali" → **Run workflow** per creare subito le carte.

## Primo admin
```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = 'tua@email.it');
```

## Limiti del gratuito
- Supabase Free mette in pausa il progetto dopo 7 giorni senza attività: basta usare l'app o aprire la dashboard.
- La generazione delle carte usa l'API di Anthropic, che è a consumo: è l'unica parte non gratuita.
  Se vuoi zero costi, crea le carte a mano dal pannello admin e disattiva il workflow.
