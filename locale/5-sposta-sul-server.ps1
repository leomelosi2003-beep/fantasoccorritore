# Passo 5: sposta il gioco dal PC al server gratuito (Oracle Cloud), SENZA perdere dati.
# Prima: sul server deve essere gia' stato lanciato server/installa.sh (Tailscale col nome "fantaserver").
# Cosa fa:
#  1. ferma il motore del gioco sul PC (i job pg_cron vengono solo messi in pausa, non cancellati)
#  2. copia completa del database + configurazione Supabase + foto/stemmi
#  3. manda tutto al server e lo carica, controllando che ogni tabella abbia le stesse righe
#  4. sposta l'indirizzo https://desktop-f0qb534.tail9a3baf.ts.net sul server
# Se qualcosa va storto prima del punto 4, il gioco torna ad andare sul PC come prima.
param([string]$Server = "fantaserver")
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # C:\fantasoccorritore
$sb = Join-Path $base "supabase"
$out = Join-Path $base "trasloco"
New-Item -ItemType Directory -Force $out | Out-Null
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"
$ssh = "root@$Server"
function Psql($sql) { docker exec supabase-db psql -U postgres -d postgres -Atc $sql }

Write-Host "Provo a collegarmi al server $Server..." -ForegroundColor Cyan
Write-Host "(se compare un link, aprilo e conferma l'accesso Tailscale)"
ssh -o StrictHostKeyChecking=accept-new $ssh "test -x /opt/fantasoccorritore/repo/server/ricevi-dati.sh"
if ($LASTEXITCODE -ne 0) { throw "Server non raggiungibile o installa.sh non ancora lanciato." }

# 1. pausa del gioco sul PC
$attivi = Psql "select jobname from cron.job where active order by 1"
$attivi | Set-Content -Encoding ascii (Join-Path $out "attivi.txt")
function Riattiva-PC {
  Write-Host "Riaccendo il gioco sul PC..." -ForegroundColor Yellow
  foreach ($j in $attivi) { if ($j) { Psql "select cron.alter_job(jobid, active := true) from cron.job where jobname = '$j'" | Out-Null } }
  Enable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue | Out-Null
  Start-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue
}
try {
  Write-Host "Metto in pausa il motore del gioco sul PC..." -ForegroundColor Cyan
  Psql "select cron.alter_job(jobid, active := false) from cron.job" | Out-Null
  Start-Sleep 45   # lascio finire l'ultimo giro del tick

  # 2. copie
  Write-Host "Copia del database..." -ForegroundColor Cyan
  docker exec supabase-db sh -c "pg_dump -U postgres -d postgres -Fc -f /tmp/gioco.dump"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump fallito" }
  docker cp supabase-db:/tmp/gioco.dump (Join-Path $out "gioco.dump")
  docker exec supabase-db rm -f /tmp/gioco.dump | Out-Null
  $q = "select relname||' '||n from (select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r') t union all select 'auth.users '||count(*) from auth.users"
  Psql $q | Set-Content -Encoding ascii (Join-Path $out "conteggi.txt")

  Write-Host "Copia di configurazione Supabase e foto (senza la cartella dati di Postgres)..." -ForegroundColor Cyan
  tar -czf (Join-Path $out "supabase.tgz") --exclude=supabase/volumes/db/data --exclude=supabase/volumes/logs -C $base supabase
  if ($LASTEXITCODE -ne 0) { throw "tar fallito" }

  # 3. invio e caricamento
  Write-Host "Invio al server..." -ForegroundColor Cyan
  scp (Join-Path $out "gioco.dump") (Join-Path $out "supabase.tgz") (Join-Path $out "conteggi.txt") (Join-Path $out "attivi.txt") "${ssh}:/opt/fantasoccorritore/arrivo/"
  if ($LASTEXITCODE -ne 0) { throw "invio fallito" }
  Write-Host "Caricamento sul server (10-15 minuti)..." -ForegroundColor Cyan
  ssh $ssh "/opt/fantasoccorritore/repo/server/ricevi-dati.sh"
  if ($LASTEXITCODE -ne 0) { throw "caricamento sul server fallito" }
} catch {
  Write-Host "ERRORE: $_" -ForegroundColor Red
  Riattiva-PC
  Write-Host "Il gioco e' tornato sul PC come prima. Manda questo errore a Claude." -ForegroundColor Yellow
  exit 1
}

# 4. il server prende il posto del PC
Write-Host "Il server e' pronto. Sposto l'indirizzo del gioco..." -ForegroundColor Cyan
Disable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue | Out-Null
Disable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Backup notturno" -ErrorAction SilentlyContinue | Out-Null
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Force -Id $_.OwningProcess -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match '3-avvia-gioco' } | ForEach-Object { Stop-Process -Force -Id $_.ProcessId -ErrorAction SilentlyContinue }
& $ts funnel reset 2>$null
& $ts set --hostname=pc-leonardo
Start-Sleep 20
ssh $ssh "tailscale set --hostname=desktop-f0qb534 && sleep 20 && tailscale funnel --bg 3000 >/dev/null && tailscale status --json | jq -r .Self.DNSName"
Set-Location $sb; docker compose stop | Out-Null   # fermo (NON cancello) la copia sul PC: resta come riserva

Write-Host "Controllo il sito pubblico..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
  Start-Sleep 15
  try { $ok = ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 "https://desktop-f0qb534.tail9a3baf.ts.net/api/version").StatusCode -eq 200) } catch {}
}
if ($ok) { Write-Host "FATTO: il gioco ora gira sul server. Il PC puo' restare spento." -ForegroundColor Green }
else { Write-Host "Il server funziona ma l'indirizzo non risponde ancora: manda a Claude l'output qui sopra." -ForegroundColor Yellow }
