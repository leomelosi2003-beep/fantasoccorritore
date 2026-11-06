# Passo 1: scarica e avvia Supabase in locale con Docker
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # C:\fantasoccorritore
$sb = Join-Path $base "supabase"
if (-not (Test-Path $sb)) {
  Write-Host "Scarico Supabase..." -ForegroundColor Cyan
  git clone --depth 1 https://github.com/supabase/supabase (Join-Path $base "supabase-src")
  Copy-Item -Recurse (Join-Path $base "supabase-src\docker") $sb
  Remove-Item -Recurse -Force (Join-Path $base "supabase-src")
}
$envFile = Join-Path $sb ".env"
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $sb ".env.example") $envFile }
node (Join-Path $PSScriptRoot "genera-chiavi.mjs") $envFile
Set-Location $sb
Write-Host "Avvio Supabase (la prima volta scarica circa 2-3 GB)..." -ForegroundColor Cyan
docker compose pull
docker compose up -d
Write-Host "Fatto. Pannello: http://localhost:8000" -ForegroundColor Green
