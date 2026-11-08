# Passo 3: avvia il sito, il tunnel internet e l'aggiornamento automatico da GitHub. Lascia aperta questa finestra.
# Parte anche da solo all'accensione del PC (vedi 4-avvio-automatico.ps1).
# Fa anche da "guardiano": se il sito o il database si fermano, li fa ripartire da solo.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$base = Split-Path -Parent $repo
$sb = Join-Path $base "supabase"
$web = Join-Path $repo "web"
$logFile = Join-Path $base "gioco.log"
function Log($msg, $color = "Gray") {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Write-Host $line -ForegroundColor $color
  Add-Content -Path $logFile -Value $line -Encoding utf8
}

# Una sola copia alla volta: se ce n'e' gia' una aperta, questa si chiude.
$mutex = New-Object System.Threading.Mutex($false, "Global\FantaSoccorritoreAvvio")
if (-not $mutex.WaitOne(0)) { Write-Host "Il gioco e' gia' avviato in un'altra finestra."; Start-Sleep 5; exit }

# Docker: se non e' acceso lo avvio e aspetto che sia pronto (fino a 10 minuti)
function DockerReady { docker info *> $null; return ($LASTEXITCODE -eq 0) }
if (-not (DockerReady)) {
  Log "Avvio Docker Desktop..." Cyan
  $dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dd) { Start-Process $dd }
  for ($i = 0; $i -lt 60 -and -not (DockerReady); $i++) { Start-Sleep 10 }
  if (-not (DockerReady)) { Log "Docker non parte: controlla lo spazio sul disco C:" Red }
}

$anon = (Get-Content (Join-Path $sb ".env") | Where-Object { $_ -match '^ANON_KEY=' }) -replace '^ANON_KEY=', ''
@"
NEXT_PUBLIC_SUPABASE_URL=same-origin
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_PROXY_TARGET=http://localhost:8000
"@ | Set-Content -Encoding ascii (Join-Path $web ".env.local")

function StartDb { Set-Location $sb; docker compose up -d *> $null }
StartDb

function Build {
  Set-Location $web
  $env:BUILD_SHA = (git -C $repo rev-parse --short HEAD)
  $script:built = (git -C $repo rev-parse HEAD)
  npm install --no-audit --no-fund
  npm run build
}
function StopSite {
  if ($script:site) {
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$($script:site.Id)" | ForEach-Object { Stop-Process -Force -Id $_.ProcessId -ErrorAction SilentlyContinue }
    Stop-Process -Force -Id $script:site.Id -ErrorAction SilentlyContinue
  }
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Force -Id $_.OwningProcess -ErrorAction SilentlyContinue }
}
function StartSite { StopSite; $script:site = Start-Process -PassThru -WindowStyle Minimized -WorkingDirectory $web "cmd.exe" "/c npm start" }
function SiteOk {
  try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 "http://localhost:3000/api/version"; return ($r.StatusCode -eq 200) } catch { return $false }
}

Build
if ($LASTEXITCODE -ne 0 -and -not (Test-Path (Join-Path $web ".next\BUILD_ID"))) { Log "Build fallita e nessuna versione precedente." Red }
StartSite
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"
if (Test-Path $ts) {
  # Indirizzo fisso con Tailscale Funnel (resta lo stesso a ogni riavvio)
  & $ts funnel --bg 3000 | Out-Null
  $url = "https://" + ((& $ts status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.'))
} else {
  # Riserva: tunnel Cloudflare temporaneo (l'indirizzo cambia a ogni avvio)
  $cf = "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
  if (-not (Test-Path $cf)) { $cf = "cloudflared" }
  $log = Join-Path $base "tunnel.log"
  $tunnel = Start-Process -PassThru -WindowStyle Minimized $cf "tunnel --url http://localhost:3000 --logfile `"$log`""
  Start-Sleep 15
  $url = (Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -Last 1).Matches.Value
}
Log "GIOCO ONLINE: $url" Green
Write-Host "Sul PC:        http://localhost:3000"
Write-Host "Lascia aperta questa finestra. Controllo il sito e gli aggiornamenti da GitHub ogni 2 minuti."

$fails = 0
while ($true) {
  Start-Sleep 120

  # Guardiano: database e sito
  $dbUp = (docker ps --filter "name=^supabase-db$" --filter "status=running" -q)
  if (-not $dbUp) { Log "Database fermo, lo riavvio..." Yellow; StartDb }
  if (SiteOk) { $fails = 0 } else {
    $fails++
    if ($fails -ge 2) { Log "Il sito non risponde, lo riavvio..." Yellow; StartSite; $fails = 0 }
  }
  if (Test-Path $ts) { & $ts funnel --bg 3000 *> $null }

  # Aggiornamenti da GitHub
  # (ricompila anche se il push e' partito da questo PC: confronta con la versione compilata)
  git -C $repo fetch -q
  if ((git -C $repo rev-parse HEAD) -ne (git -C $repo rev-parse "@{u}")) { git -C $repo pull -q }
  if ((git -C $repo rev-parse HEAD) -ne $script:built) {
    Log "Nuovo aggiornamento, installo..." Cyan
    Build
    if ($LASTEXITCODE -eq 0) { StartSite; Log "Aggiornato." Green }
    else { Log "Build fallita, resta attiva la versione precedente." Red }
  }
}
