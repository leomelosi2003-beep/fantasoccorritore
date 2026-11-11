#!/usr/bin/env bash
# Ogni 2 minuti: database acceso, sito che risponde, tunnel attivo, aggiornamenti da GitHub.
BASE=/opt/fantasoccorritore; REPO=$BASE/repo; WEB=$REPO/web; SB=$BASE/supabase
LOG=$BASE/gioco.log
log() { echo "$(date '+%F %T') $*" >> $LOG; }
[ -f $SB/.env ] || exit 0          # dati non ancora arrivati dal PC

anon=$(grep '^ANON_KEY=' $SB/.env | cut -d= -f2- | tr -d '\r')
printf 'NEXT_PUBLIC_SUPABASE_URL=same-origin\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nSUPABASE_PROXY_TARGET=http://localhost:8000\n' "$anon" > $WEB/.env.local.new
cmp -s $WEB/.env.local.new $WEB/.env.local || { mv $WEB/.env.local.new $WEB/.env.local; rm -f $BASE/.built; }
rm -f $WEB/.env.local.new

docker ps --filter name=^supabase-db$ --filter status=running -q | grep -q . || { log "Database fermo, lo avvio"; (cd $SB && docker compose up -d >/dev/null 2>&1); }

build() {
  cd $WEB && export BUILD_SHA=$(git -C $REPO rev-parse --short HEAD)
  npm install --no-audit --no-fund >/dev/null 2>&1 && npm run build >> $LOG 2>&1
}
git -C $REPO fetch -q && git -C $REPO merge -q --ff-only '@{u}' 2>/dev/null
HEAD=$(git -C $REPO rev-parse HEAD)
if [ "$HEAD" != "$(cat $BASE/.built 2>/dev/null)" ]; then
  log "Nuova versione $HEAD, compilo..."
  if build; then echo $HEAD > $BASE/.built; systemctl restart fs-web; log "Aggiornato."; else log "Build fallita, resta la versione precedente."; fi
fi

if ! curl -sf -m 20 http://localhost:3000/api/version >/dev/null; then
  sleep 20; curl -sf -m 20 http://localhost:3000/api/version >/dev/null || { log "Sito fermo, lo riavvio"; systemctl restart fs-web; }
fi
tailscale funnel --bg 3000 >/dev/null 2>&1 || true
# disco: pulizia immagini Docker inutili se si supera l'85% (MAI i volumi)
[ "$(df --output=pcent / | tail -1 | tr -dc 0-9)" -gt 85 ] && { log "Disco pieno, pulisco immagini"; docker image prune -af >/dev/null; docker builder prune -af >/dev/null; }
exit 0
