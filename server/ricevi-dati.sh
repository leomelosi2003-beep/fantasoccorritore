#!/usr/bin/env bash
# Chiamato dal PC (locale/5-sposta-sul-server.ps1) dopo aver mandato i file in /opt/fantasoccorritore/arrivo:
#   supabase.tgz  (configurazione Supabase del PC + foto/stemmi, SENZA la cartella dati di Postgres)
#   gioco.dump    (pg_dump -Fc di tutto il database)
#   conteggi.txt  (righe per tabella sul PC, per il controllo)
#   attivi.txt    (job pg_cron che erano attivi sul PC)
set -uo pipefail
BASE=/opt/fantasoccorritore; IN=$BASE/arrivo; SB=$BASE/supabase
die() { echo "ERRORE: $*"; exit 1; }
for f in supabase.tgz gioco.dump conteggi.txt attivi.txt; do [ -s $IN/$f ] || die "manca $f"; done

if [ -d $SB/volumes/db/data ] && [ -n "$(ls -A $SB/volumes/db/data 2>/dev/null)" ]; then
  die "sul server c'e' gia' un database: non lo sovrascrivo. (Se e' un tentativo fallito: docker compose down e sposta via $SB)"
fi
echo ">> Estraggo configurazione e file caricati"
tar -xzf $IN/supabase.tgz -C $BASE
# gli script .sh copiati da Windows potrebbero avere a capo CRLF
find $SB -name '*.sh' -exec sed -i 's/\r$//' {} +
cd $SB && docker compose pull -q && docker compose up -d
PW=$(grep '^POSTGRES_PASSWORD=' $SB/.env | cut -d= -f2- | tr -d '\r')
DX="docker exec -e PGPASSWORD=$PW"
echo ">> Aspetto il database"
for i in $(seq 1 60); do docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 5; done
sleep 20
# fermo il motore del nuovo database finche' non ho finito
$DX supabase-db psql -h localhost -U supabase_admin -d postgres -qc "select cron.alter_job(jobid, active := false) from cron.job" >/dev/null 2>&1

echo ">> Carico il database (qualche avviso e' normale)"
$DX -i supabase-db pg_restore -h localhost -U supabase_admin -d postgres --clean --if-exists < $IN/gioco.dump 2> $IN/restore.log
echo "   avvisi: $(grep -c 'error' $IN/restore.log) (dettagli in $IN/restore.log)"

echo ">> Controllo righe tabella per tabella"
docker exec supabase-db psql -U postgres -d postgres -Atc "select relname||' '||n from (select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r') t order by 1" > $IN/conteggi-server.txt
docker exec supabase-db psql -U postgres -d postgres -Atc "select 'auth.users '||count(*) from auth.users" >> $IN/conteggi-server.txt
sort -o $IN/conteggi-server.txt $IN/conteggi-server.txt; sort $IN/conteggi.txt | tr -d '\r' > $IN/conteggi-pc.txt
if ! diff $IN/conteggi-pc.txt $IN/conteggi-server.txt > $IN/differenze.txt; then
  cat $IN/differenze.txt | head -20
  die "i dati non coincidono col PC: il gioco sul server NON e' stato acceso"
fi
echo "   tutte le tabelle coincidono"

echo ">> Accendo il motore del gioco"
tr -d '\r' < $IN/attivi.txt | while read -r j; do [ -n "$j" ] && docker exec supabase-db psql -U postgres -d postgres -qc "select cron.alter_job(jobid, active := true) from cron.job where jobname = '$j'" >/dev/null; done
docker exec supabase-db psql -U postgres -d postgres -qc "vacuum (analyze)" >/dev/null 2>&1
rm -f $BASE/.built
systemctl start fs-guardiano.service    # compila il sito (qualche minuto)
systemctl restart fs-web
for i in $(seq 1 30); do curl -sf http://localhost:3000/api/version >/dev/null && break; sleep 10; done
curl -sf http://localhost:3000/api/version >/dev/null || die "il sito non risponde (vedi $BASE/gioco.log)"
tailscale funnel --bg 3000 >/dev/null
echo "OK"
