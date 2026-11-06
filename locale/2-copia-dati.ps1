# Passo 2: copia tutto il database (dati, utenti, funzioni) dal Supabase online a quello locale
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sb = Join-Path $base "supabase"
$dump = Join-Path $base "backup"
New-Item -ItemType Directory -Force $dump | Out-Null
$pw = (Get-Content (Join-Path $sb ".env") | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''

Write-Host "Incolla la stringa di connessione del Supabase online" -ForegroundColor Cyan
Write-Host "(pannello Supabase > Connect > Session pooler, con la password del database al posto di [YOUR-PASSWORD])"
$cloud = Read-Host "Stringa"

Write-Host "Scarico ruoli, struttura e dati..." -ForegroundColor Cyan
npx -y supabase@latest db dump --db-url $cloud -f (Join-Path $dump "roles.sql") --role-only
npx -y supabase@latest db dump --db-url $cloud -f (Join-Path $dump "schema.sql")
npx -y supabase@latest db dump --db-url $cloud -f (Join-Path $dump "data.sql") --use-copy --data-only

Write-Host "Preparo i file per il database locale..." -ForegroundColor Cyan
# roles.sql: in locale l'utente postgres non puo' modificare il ruolo riservato supabase_admin
Get-Content (Join-Path $dump "roles.sql") | Where-Object { $_ -notmatch 'ROLE "supabase_admin"' } |
  Set-Content -Encoding utf8 (Join-Path $dump "roles-locale.sql")
# data.sql: tolgo solo i blocchi COPY senza dati (es. tabelle interne di storage su cui postgres non ha permessi)
$r = [System.IO.StreamReader]::new((Join-Path $dump "data.sql"), [System.Text.UTF8Encoding]::new($false))
$w = [System.IO.StreamWriter]::new((Join-Path $dump "data-locale.sql"), $false, [System.Text.UTF8Encoding]::new($false))
$w.NewLine = "`n"; $pending = $null
while ($null -ne ($line = $r.ReadLine())) {
  if ($null -ne $pending) {
    if ($line -eq '\.') { $pending = $null; continue }
    $w.WriteLine($pending); $pending = $null
  }
  if ($line -match '^COPY .* FROM stdin;$') { $pending = $line; continue }
  $w.WriteLine($line)
}
if ($null -ne $pending) { $w.WriteLine($pending) }
$r.Close(); $w.Close()

Write-Host "Carico nel database locale..." -ForegroundColor Cyan
foreach ($f in "roles","schema","data") {
  $src = if ($f -eq "schema") { "schema.sql" } else { "$f-locale.sql" }
  docker cp (Join-Path $dump $src) "supabase-db:/tmp/$f.sql"
}
docker exec -e PGPASSWORD=$pw supabase-db psql -h localhost -U postgres -d postgres --single-transaction -v ON_ERROR_STOP=1 `
  -f /tmp/roles.sql -f /tmp/schema.sql -c "SET session_replication_role = replica" -f /tmp/data.sql
if ($LASTEXITCODE -ne 0) { throw "Caricamento fallito: il database locale e' rimasto com'era. Manda l'errore a Claude." }

Write-Host "Riattivo il motore del gioco (tick ogni 30 secondi)..." -ForegroundColor Cyan
docker exec -e PGPASSWORD=$pw supabase-db psql -h localhost -U postgres -d postgres -c `
  "select cron.unschedule(jobid) from cron.job; select cron.schedule('game-tick', '30 seconds', 'call public.game_tick()');"
Write-Host "Dati copiati." -ForegroundColor Green
