#!/usr/bin/env bash
# Porta il gioco dal Supabase CLOUD (piano Free) al server Oracle. Nessun dato cancellato:
# sul cloud il motore viene solo messo in pausa e tutto resta com'e' (riserva).
# Chiamato dal PC con locale/7-sposta-su-oracle.ps1, che manda prima /opt/fantasoccorritore/arrivo/supabase.tgz
# (configurazione Supabase del PC, senza la cartella dati di Postgres).
# La password del database cloud arriva sulla prima riga di stdin.
set -uo pipefail
BASE=/opt/fantasoccorritore; IN=$BASE/arrivo; SB=$BASE/supabase; REPO=$BASE/repo
REF=saagkulmwofgvlssiucw
NOME=$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//')
die() { echo "ERRORE: $*"; exit 1; }
read -r CP || die "password del cloud non ricevuta"
CP=${CP%$'\r'}   # da Windows la riga arriva con \r finale
[ -s $IN/supabase.tgz ] || die "manca $IN/supabase.tgz"

# se i dati del gioco sono gia' stati caricati, non sovrascrivo niente
[ -f $IN/.dati-caricati ] && die "sul server i dati del gioco ci sono gia': non li sovrascrivo"

echo ">> 1/8 Configurazione Supabase"
tar -xzf $IN/supabase.tgz -C $BASE
find $SB -name '*.sh' -exec sed -i 's/\r$//' {} +
sed -i 's/\r$//' $SB/.env
# indirizzi: dal PC (desktop-f0qb534) al server
sed -i "s#desktop-f0qb534\.tail9a3baf\.ts\.net#$NOME#g" $SB/.env
cd $SB && docker compose pull -q && docker compose up -d || die "docker compose non parte"
LPW=$(grep '^POSTGRES_PASSWORD=' $SB/.env | cut -d= -f2-)
SVC=$(grep '^SERVICE_ROLE_KEY=' $SB/.env | cut -d= -f2-)
for i in $(seq 1 60); do docker exec supabase-db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 5; done
sleep 30
L()  { docker exec -e PGPASSWORD=$LPW supabase-db psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
LA() { docker exec -e PGPASSWORD=$LPW supabase-db psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
L -c "select 1" >/dev/null || die "il database del server non risponde"

echo ">> 2/8 Collegamento al cloud"
CH=""
for h in aws-1-eu-west-1.pooler.supabase.com aws-0-eu-west-1.pooler.supabase.com; do
  if docker exec -e PGPASSWORD="$CP" -e PGSSLMODE=require supabase-db psql -h $h -p 5432 -U postgres.$REF -d postgres -qAtc "select 1" >/dev/null 2>&1; then CH=$h; break; fi
done
[ -n "$CH" ] || die "non riesco a collegarmi al cloud: la password e' giusta?"
C()  { docker exec -e PGPASSWORD="$CP" -e PGSSLMODE=require -e PGOPTIONS='-c client_min_messages=warning' supabase-db psql -h $CH -p 5432 -U postgres.$REF -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
COUNT="select relname||' '||n from (select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r') t order by 1"

echo ">> 3/8 Metto in pausa il gioco sul cloud (resta tutto li', come riserva)"
C -c "select format('select cron.schedule(%L, %L, %L); select cron.alter_job(jobid, active := %L) from cron.job where jobname = %L;', jobname, schedule, command, active, jobname) from cron.job" > $IN/jobs.sql || die "lettura dei job fallita"
C -c "select jobname from cron.job where active" > $IN/attivi-cloud.txt
riaccendi_cloud() {
  echo "   riaccendo il gioco sul cloud"
  while read -r j; do [ -n "$j" ] && C -c "select cron.alter_job(jobid, active := true) from cron.job where jobname = '$j'" >/dev/null; done < $IN/attivi-cloud.txt
}
C -c "select cron.alter_job(jobid, active := false) from cron.job" >/dev/null || die "pausa fallita"
sleep 70   # lascio finire l'ultimo giro del motore

echo ">> 4/8 Copia dei dati dal cloud (qualche minuto)"
C -c "$COUNT" > $IN/conteggi-cloud.txt || { riaccendi_cloud; die "conteggio sul cloud fallito"; }
docker exec -e PGPASSWORD="$CP" -e PGSSLMODE=require supabase-db sh -c \
  "pg_dump -h $CH -p 5432 -U postgres.$REF -d postgres -n public -Fc -f /tmp/pub.dump" || { riaccendi_cloud; die "pg_dump fallito"; }
C -c "select coalesce(json_agg(u), json_build_array()) from auth.users u" > $IN/users.json || { riaccendi_cloud; die "utenti"; }
C -c "select coalesce(json_agg(i), json_build_array()) from auth.identities i" > $IN/idents.json || { riaccendi_cloud; die "identita"; }
C -c "select bucket_id||'|'||name||'|'||coalesce(metadata->>'mimetype','application/octet-stream') from storage.objects" > $IN/oggetti.txt
C -c "select id||'|'||public::text from storage.buckets" > $IN/bucket.txt
docker cp supabase-db:/tmp/pub.dump $IN/pub.dump
echo "   $(wc -l < $IN/conteggi-cloud.txt) tabelle, $(du -m $IN/pub.dump | cut -f1) MB"

echo ">> 5/8 Carico i dati sul server (10-20 minuti)"
LA -c "create extension if not exists postgis with schema extensions; create extension if not exists pg_cron; create extension if not exists pg_net; create extension if not exists pg_stat_statements with schema extensions;" \
  || { riaccendi_cloud; die "estensioni"; }
LA -c "select cron.alter_job(jobid, active := false) from cron.job" >/dev/null 2>&1
docker exec -e PGPASSWORD=$LPW supabase-db sh -c "pg_restore -h localhost -U postgres -d postgres --no-owner /tmp/pub.dump 2> /tmp/restore.log; true"
docker cp supabase-db:/tmp/restore.log $IN/restore.log
touch $IN/.dati-caricati
echo "   avvisi: $(grep -c -i error $IN/restore.log) (dettagli in $IN/restore.log)"

echo ">> 6/8 Controllo righe tabella per tabella"
L -c "$COUNT" > $IN/conteggi-server.txt
manca=$(join -a1 -e 0 -o 0,1.2,2.2 <(sort $IN/conteggi-cloud.txt) <(sort $IN/conteggi-server.txt) | awk '$3 < $2 {print}')
if [ -n "$manca" ]; then
  echo "$manca" | head -20
  riaccendi_cloud
  die "sul server mancano righe: il gioco resta sul cloud"
fi
echo "   tutte le $(wc -l < $IN/conteggi-cloud.txt) tabelle ci sono"

echo ">> 7/8 Utenti, regole, foto"
docker cp $IN/users.json supabase-db:/tmp/users.json; docker cp $IN/idents.json supabase-db:/tmp/idents.json
docker cp $REPO/server/oracle-dopo.sql supabase-db:/tmp/oracle-dopo.sql
docker exec -e PGPASSWORD=$LPW supabase-db psql -h localhost -U supabase_admin -d postgres -qAt -f /tmp/oracle-dopo.sql || die "passo 7 fallito (i dati sono gia' sul server: avvisa Claude)"
while IFS='|' read -r id pub; do
  [ -n "$id" ] && curl -s -o /dev/null -X POST -H "Authorization: Bearer $SVC" -H "apikey: $SVC" -H 'Content-Type: application/json' \
    -d "{\"id\":\"$id\",\"name\":\"$id\",\"public\":$pub}" http://localhost:8000/storage/v1/bucket
done < $IN/bucket.txt
ok=0; ko=0
while IFS='|' read -r bk name mime; do
  [ -n "$bk" ] || continue
  p=$(python3 -c 'import sys,urllib.parse;print("/".join(urllib.parse.quote(x) for x in sys.argv[1].split("/")))' "$name")
  if curl -sf -o /tmp/obj "https://$REF.supabase.co/storage/v1/object/public/$bk/$p" && \
     curl -sf -o /dev/null -X POST -H "Authorization: Bearer $SVC" -H "apikey: $SVC" -H "x-upsert: true" -H "Content-Type: $mime" \
       --data-binary @/tmp/obj "http://localhost:8000/storage/v1/object/$bk/$p"; then ok=$((ok+1)); else ko=$((ko+1)); echo "   non copiato: $bk/$name"; fi
done < $IN/oggetti.txt
echo "   file copiati: $ok, non copiati: $ko"

echo ">> 8/8 Accendo il gioco sul server"
docker cp $IN/jobs.sql supabase-db:/tmp/jobs.sql
LA -f /tmp/jobs.sql >/dev/null || echo "   ATTENZIONE: job pg_cron da sistemare (avvisa Claude)"
L -c "vacuum (analyze)" >/dev/null 2>&1
rm -f $BASE/.built
systemctl start fs-guardiano.service    # compila il sito (qualche minuto)
systemctl restart fs-web
for i in $(seq 1 40); do curl -sf http://localhost:3000/api/version >/dev/null && break; sleep 10; done
curl -sf http://localhost:3000/api/version >/dev/null || die "il sito non risponde ancora (vedi $BASE/gioco.log): avvisa Claude"
tailscale funnel --bg 3000 >/dev/null
sleep 70
echo "   ultimo giro del motore: $(L -c "select status||' '||round(extract(epoch from end_time-start_time)::numeric,1)||'s' from cron.job_run_details d join cron.job j using (jobid) where j.jobname='game-tick' order by runid desc limit 1")"
echo "OK https://$NOME"
