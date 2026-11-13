#!/usr/bin/env bash
# Crea un link per rifare la password di un giocatore, senza email. Uso: bash link-password.sh <email>
set -uo pipefail
ENV=/opt/fantasoccorritore/supabase/.env
SVC=$(grep '^SERVICE_ROLE_KEY=' $ENV | cut -d= -f2-)
URL="https://$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//')"
EMAIL="${1:?scrivi l\'email}"
H=$(curl -s -X POST -H "Authorization: Bearer $SVC" -H "apikey: $SVC" -H 'Content-Type: application/json' \
  -d "{\"type\":\"recovery\",\"email\":\"$EMAIL\",\"redirect_to\":\"$URL/reset\"}" \
  http://localhost:8000/auth/v1/admin/generate_link | jq -r '.hashed_token // .properties.hashed_token // empty')
[ -n "$H" ] || { echo "ERRORE: utente non trovato"; exit 1; }
echo "LINK: $URL/sb/auth/v1/verify?token=$H&type=recovery&redirect_to=$URL/reset"
