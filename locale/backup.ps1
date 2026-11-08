# Backup notturno del gioco (lanciato in automatico ogni notte alle 04:00).
# Solo LETTURA dal database: non modifica nulla.
# - copia completa del database (pg_dump compresso) in C:\fantasoccorritore\backup-auto (ultimi 14)
# - copia anche in OneDrive\FantaSoccorritore-backup (ultimi 7), cosi' resta salva fuori dal PC
# - copia dei file caricati (stemmi, foto)
$ErrorActionPreference = "Continue"
$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # C:\fantasoccorritore
$dir = Join-Path $base "backup-auto"
New-Item -ItemType Directory -Force $dir | Out-Null
$logFile = Join-Path $base "gioco.log"
function Log($m) { Add-Content -Path $logFile -Encoding utf8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [backup] $m"; Write-Host $m }

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$file = Join-Path $dir "fantasoccorritore-$stamp.dump"

# pg_dump dentro il container, formato compresso (-Fc), poi lo copio fuori
docker exec supabase-db sh -c "pg_dump -U postgres -d postgres -Fc -f /tmp/fs-backup.dump" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Log "ERRORE: pg_dump fallito (Docker acceso?)"; exit 1 }
docker cp supabase-db:/tmp/fs-backup.dump $file | Out-Null
docker exec supabase-db rm -f /tmp/fs-backup.dump | Out-Null
if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1MB) { Log "ERRORE: file di backup mancante o troppo piccolo"; exit 1 }

# file caricati dai giocatori
$storage = Join-Path $base "supabase\volumes\storage"
$zip = Join-Path $dir "storage-$stamp.zip"
if (Test-Path $storage) { Compress-Archive -Path (Join-Path $storage "*") -DestinationPath $zip -Force -ErrorAction SilentlyContinue }

# copia fuori dal PC (OneDrive)
$od = $env:OneDrive; if (-not $od) { $od = Join-Path $env:USERPROFILE "OneDrive" }
if (Test-Path $od) {
  $cloud = Join-Path $od "FantaSoccorritore-backup"
  New-Item -ItemType Directory -Force $cloud | Out-Null
  Copy-Item $file $cloud -Force
  if (Test-Path $zip) { Copy-Item $zip $cloud -Force }
  Get-ChildItem $cloud -Filter "fantasoccorritore-*.dump" | Sort-Object Name -Descending | Select-Object -Skip 7 | Remove-Item -Force
  Get-ChildItem $cloud -Filter "storage-*.zip" | Sort-Object Name -Descending | Select-Object -Skip 7 | Remove-Item -Force
}

# tengo solo gli ultimi 14 backup sul PC
Get-ChildItem $dir -Filter "fantasoccorritore-*.dump" | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Force
Get-ChildItem $dir -Filter "storage-*.zip" | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Force

Log ("OK {0:N0} MB -> {1}" -f ((Get-Item $file).Length / 1MB), $file)

# Per ripristinare (SOLO in caso di disastro):
#   docker cp <file.dump> supabase-db:/tmp/r.dump
#   docker exec supabase-db pg_restore -U postgres -d postgres --clean --if-exists /tmp/r.dump
