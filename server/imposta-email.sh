#!/usr/bin/env bash
# Sistema gli indirizzi di accesso (link nelle email) e, se arriva una password per le app di Gmail
# sulla prima riga di stdin, attiva l'invio delle email (password dimenticata) da Gmail.
# Uso: echo "<password app gmail>" | bash imposta-email.sh <indirizzo gmail>
set -uo pipefail
SB=/opt/fantasoccorritore/supabase; ENV=$SB/.env
NOME=$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//')
URL="https://$NOME"
MAIL="${1:-}"
PW=""; read -r PW || true; PW=${PW%$'\r'}; PW=${PW// /}
set_env() { if grep -q "^$1=" $ENV; then sed -i "s#^$1=.*#$1=$2#" $ENV; else echo "$1=$2" >> $ENV; fi; }
cp $ENV $ENV.prima-email
set_env SITE_URL "$URL"
set_env API_EXTERNAL_URL "$URL/sb/auth/v1"
set_env ADDITIONAL_REDIRECT_URLS "$URL/**,https://web-kappa-ten-1vwv7qwb59.vercel.app/**,http://localhost:3000/**"
for t in INVITE CONFIRMATION RECOVERY EMAIL_CHANGE; do set_env MAILER_URLPATHS_$t '"/sb/auth/v1/verify"'; done
if [ -n "$PW" ] && [ -n "$MAIL" ]; then
  set_env SMTP_HOST smtp.gmail.com
  set_env SMTP_PORT 587
  set_env SMTP_USER "$MAIL"
  set_env SMTP_PASS "$PW"
  set_env SMTP_ADMIN_EMAIL "$MAIL"
  set_env SMTP_SENDER_NAME FantaSoccorritore
  echo "email: invio da $MAIL attivato"
fi
cd $SB && docker compose up -d auth >/dev/null 2>&1 && echo "OK accesso aggiornato ($URL)"
