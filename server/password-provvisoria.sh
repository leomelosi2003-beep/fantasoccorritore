#!/usr/bin/env bash
# Dà a un giocatore una password provvisoria (da cambiare poi in /reset). Uso: bash password-provvisoria.sh <email>
set -uo pipefail
ENV=/opt/fantasoccorritore/supabase/.env
SVC=$(grep '^SERVICE_ROLE_KEY=' $ENV | cut -d= -f2-)
EMAIL="${1:?scrivi l\'email}"
ID=$(docker exec supabase-db psql -U postgres -d postgres -Atc "select id from auth.users where lower(email)=lower('$EMAIL')")
[ -n "$ID" ] || { echo "ERRORE: utente non trovato"; exit 1; }
PW="Soccorso-$(shuf -i 1000-9999 -n1)-$(tr -dc a-z </dev/urandom | head -c4)"
curl -sf -o /dev/null -X PUT -H "Authorization: Bearer $SVC" -H "apikey: $SVC" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$PW\"}" http://localhost:8000/auth/v1/admin/users/$ID || { echo "ERRORE: password non cambiata"; exit 1; }
echo "PASSWORD PROVVISORIA per $EMAIL: $PW"
