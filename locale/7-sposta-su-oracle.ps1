# Passo 7: sposta il gioco dal Supabase CLOUD al server Oracle (fantaserver), senza perdere dati.
# Il cloud viene solo messo in pausa (resta come riserva), il database del PC non viene toccato.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$base = Split-Path -Parent $repo          # C:\fantasoccorritore
$out = Join-Path $base "trasloco-oracle"
New-Item -ItemType Directory -Force $out | Out-Null
$ssh = "root@fantaserver"

Write-Host "Controllo il server Oracle..." -ForegroundColor Cyan
Write-Host "(se si apre una pagina di Tailscale nel browser, conferma l'accesso)"
ssh -o StrictHostKeyChecking=accept-new $ssh "test -f /opt/fantasoccorritore/repo/server/installa.sh && systemctl is-enabled fs-web >/dev/null && git -C /opt/fantasoccorritore/repo pull -q && test -f /opt/fantasoccorritore/repo/server/ricevi-dal-cloud.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Il server non e' pronto (non raggiungibile o ancora in installazione). Riprova tra 5 minuti." -ForegroundColor Yellow
  Read-Host "Premi Invio per chiudere"; exit 1
}
Write-Host "Server pronto." -ForegroundColor Green

$cp = (Read-Host "Incolla la PASSWORD del database Supabase (la stessa dell'altra volta) e premi Invio").Trim()

Write-Host "Preparo la configurazione Supabase del PC (senza dati di Postgres)..." -ForegroundColor Cyan
tar -czf (Join-Path $out "supabase.tgz") --exclude=supabase/volumes/db/data --exclude=supabase/volumes/logs --exclude=supabase/volumes/storage -C $base supabase
if ($LASTEXITCODE -ne 0) { Write-Host "tar fallito" -ForegroundColor Red; Read-Host "Premi Invio"; exit 1 }
scp (Join-Path $out "supabase.tgz") "${ssh}:/opt/fantasoccorritore/arrivo/"
if ($LASTEXITCODE -ne 0) { Write-Host "invio fallito" -ForegroundColor Red; Read-Host "Premi Invio"; exit 1 }

Write-Host "Trasloco in corso (20-30 minuti, non chiudere questa finestra)..." -ForegroundColor Cyan
$cp | ssh $ssh "bash /opt/fantasoccorritore/repo/server/ricevi-dal-cloud.sh 2>&1 | tee /opt/fantasoccorritore/arrivo/trasloco.log" | Tee-Object -FilePath (Join-Path $out "trasloco.log")
$fine = Get-Content (Join-Path $out "trasloco.log") -Tail 1
if ($fine -match '^OK ') { Write-Host "FATTO: il gioco gira su Oracle. Scrivi 'fatto' a Claude." -ForegroundColor Green }
else { Write-Host "Qualcosa non e' andato: scrivi a Claude (il log e' in $out\trasloco.log)." -ForegroundColor Yellow }
Read-Host "Premi Invio per chiudere"
