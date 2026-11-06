# Passo 3: avvia il sito, il tunnel internet e l'aggiornamento automatico da GitHub. Lascia aperta questa finestra.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$base = Split-Path -Parent $repo
$sb = Join-Path $base "supabase"
$web = Join-Path $repo "web"
$anon = (Get-Content (Join-Path $sb ".env") | Where-Object { $_ -match '^ANON_KEY=' }) -replace '^ANON_KEY=', ''
@"
NEXT_PUBLIC_SUPABASE_URL=same-origin
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_PROXY_TARGET=http://localhost:8000
"@ | Set-Content -Encoding ascii (Join-Path $web ".env.local")

Set-Location (Join-Path $base "supabase"); docker compose up -d | Out-Null

function Build {
  Set-Location $web
  $env:BUILD_SHA = (git -C $repo rev-parse --short HEAD)
  npm install --no-audit --no-fund
  npm run build
}
function StartSite { Start-Process -PassThru -WindowStyle Minimized -WorkingDirectory $web "cmd.exe" "/c npm start" }

Build
$site = StartSite
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
Write-Host ""
Write-Host "GIOCO ONLINE:  $url" -ForegroundColor Green
Write-Host "Sul PC:        http://localhost:3000"
Write-Host "Lascia aperta questa finestra. Controllo gli aggiornamenti da GitHub ogni 2 minuti."

while ($true) {
  Start-Sleep 120
  git -C $repo fetch -q
  if ((git -C $repo rev-parse HEAD) -ne (git -C $repo rev-parse "@{u}")) {
    Write-Host "$(Get-Date -Format HH:mm) Nuovo aggiornamento, installo..." -ForegroundColor Cyan
    git -C $repo pull -q
    Build
    if ($LASTEXITCODE -eq 0) {
      Get-CimInstance Win32_Process -Filter "ParentProcessId=$($site.Id)" | ForEach-Object { Stop-Process -Force -Id $_.ProcessId -ErrorAction SilentlyContinue }
      Stop-Process -Force -Id $site.Id -ErrorAction SilentlyContinue
      Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Force -Id $_.OwningProcess -ErrorAction SilentlyContinue }
      $site = StartSite
      Write-Host "$(Get-Date -Format HH:mm) Aggiornato." -ForegroundColor Green
    } else { Write-Host "Build fallita, resta attiva la versione precedente." -ForegroundColor Red }
  }
}
