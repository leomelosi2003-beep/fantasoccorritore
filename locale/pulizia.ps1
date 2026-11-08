# Pulizia settimanale del disco (lanciata in automatico la domenica alle 05:00).
# Toglie SOLO cose ricostruibili: cache di build di Docker, immagini Docker non usate, cache di Next.
# MAI volumi o dati del database (stanno in C:\fantasoccorritore\supabase\volumes).
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logFile = Join-Path $base "gioco.log"
function Log($m) { Add-Content -Path $logFile -Encoding utf8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [pulizia] $m"; Write-Host $m }

$before = (Get-PSDrive C).Free
docker builder prune -af *> $null
docker image prune -f *> $null          # solo immagini "orfane", non quelle in uso
$cache = Join-Path $base "repo\web\.next\cache"
if (Test-Path $cache) {
  $size = (Get-ChildItem $cache -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if ($size -gt 1GB) { Remove-Item -Recurse -Force $cache -ErrorAction SilentlyContinue }
}
# log del gioco: se supera 5 MB tengo solo le ultime 2000 righe
if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 5MB) {
  $tail = Get-Content $logFile -Tail 2000; $tail | Set-Content -Encoding utf8 $logFile
}
$after = (Get-PSDrive C).Free
Log ("Liberati {0:N0} MB. Spazio libero su C: {1:N1} GB" -f (($after - $before) / 1MB), ($after / 1GB))
if ($after -lt 10GB) { Log "ATTENZIONE: meno di 10 GB liberi su C:" }
