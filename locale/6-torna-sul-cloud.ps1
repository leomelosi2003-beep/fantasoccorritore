# Passo 6: riporta il gioco dal PC al Supabase CLOUD gratuito (il sito torna su Vercel). Nessun dato cancellato:
#  - sul cloud il vecchio schema public resta salvato come public_cloud_20261106
#  - sul PC il database resta com'e' (solo fermato)
# Se qualcosa va storto, cloud e PC tornano come prima e il gioco riparte sul PC.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
$base = Split-Path -Parent $repo
$sb = Join-Path $base "supabase"
$out = Join-Path $base "trasloco-cloud"
New-Item -ItemType Directory -Force $out | Out-Null
$log = Join-Path $out "trasloco.log"
$REF = "saagkulmwofgvlssiucw"; $CLOUD = "https://$REF.supabase.co"
$OLD = "public_cloud_20261106"
function Say($m, $c = "Cyan") { Write-Host $m -ForegroundColor $c; Add-Content $log "$(Get-Date -Format 'HH:mm:ss') $m" }

$cp = (Read-Host "Incolla la PASSWORD del database e premi Invio").Trim()
$svc = (Read-Host "Incolla la CHIAVE service_role e premi Invio").Trim()
$cu = "postgres.$REF"; $cport = "5432"; $cdb = "postgres"; $ch = $null
$cenv = @("-e", "PGHOST=$ch", "-e", "PGPORT=$cport", "-e", "PGUSER=$cu", "-e", "PGPASSWORD=$cp", "-e", "PGDATABASE=$cdb", "-e", "PGSSLMODE=require", "-e", "PGOPTIONS=-c client_min_messages=warning")
function L($sql) { $r = docker exec supabase-db psql -U postgres -d postgres -qAtc $sql; if ($LASTEXITCODE -ne 0) { throw "errore sul PC: $sql" }; $r }
function C($sql) { $r = docker exec @cenv supabase-db psql -qAtc $sql; if ($LASTEXITCODE -ne 0) { throw "errore sul cloud: $sql" }; $r }
function CSh($cmd) { docker exec @cenv supabase-db sh -c $cmd; if ($LASTEXITCODE -ne 0) { throw "errore sul cloud: $cmd" } }

foreach ($h in "aws-1-eu-west-1.pooler.supabase.com", "aws-0-eu-west-1.pooler.supabase.com") {
  $ch = $h
  $cenv = @("-e", "PGHOST=$ch", "-e", "PGPORT=$cport", "-e", "PGUSER=$cu", "-e", "PGPASSWORD=$cp", "-e", "PGDATABASE=$cdb", "-e", "PGSSLMODE=require", "-e", "PGOPTIONS=-c client_min_messages=warning")
  docker exec @cenv supabase-db psql -qAtc "select 1" *> $null
  if ($LASTEXITCODE -eq 0) { break } else { $ch = $null }
}
if (-not $ch) { Say "Non riesco a collegarmi al cloud: la password e' giusta?" Red; exit 1 }
Say "Collegato al cloud." Green
if ((C "select count(*) from pg_namespace where nspname = '$OLD'") -ne "0") { Say "Il trasloco risulta gia' fatto (esiste $OLD sul cloud). Mi fermo." Yellow; exit 1 }
$hdr = @{ Authorization = "Bearer $svc"; apikey = $svc }
try { Invoke-RestMethod -Headers $hdr "$CLOUD/storage/v1/bucket" | Out-Null } catch { Say "La chiave service_role non funziona." Red; exit 1 }

$countSql = "select relname||' '||n from (select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind='r') t order by 1"

# --- 1. fermo il gioco sul PC
$attivi = @(L "select jobname from cron.job where active")
$jobsSql = (L "select format('select cron.schedule(%L, %L, %L); select cron.alter_job(jobid, active := %s) from cron.job where jobname = %L;', jobname, schedule, command, active, jobname) from cron.job") -join "`n"
[IO.File]::WriteAllText((Join-Path $out "jobs.sql"), $jobsSql + "`n")
$renamed = $false
function Riattiva-PC {
  Say "Riaccendo il gioco sul PC..." Yellow
  foreach ($j in $attivi) { if ($j) { docker exec supabase-db psql -U postgres -d postgres -qAtc "select cron.alter_job(jobid, active := true) from cron.job where jobname = '$j'" | Out-Null } }
  Enable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue | Out-Null
  Start-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue
}
function Ripristina-Cloud {
  if (-not $script:renamed) { return }
  Say "Rimetto il cloud com'era (lo schema caricato resta come public_fallito)..." Yellow
  docker exec @cenv supabase-db psql -qAtc "alter schema public rename to public_fallito_$(Get-Date -Format 'yyyyMMdd_HHmm'); alter schema $OLD rename to public;" | Out-Null
  docker exec @cenv supabase-db psql -qAtc "drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user(); notify pgrst, 'reload schema';" | Out-Null
}

try {
  Say "1/7 Fermo il gioco sul PC (i giocatori vedranno il sito spento per qualche minuto)..."
  Disable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -ErrorAction SilentlyContinue | Out-Null
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match '3-avvia-gioco' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Force -Id $_.ProcessId -ErrorAction SilentlyContinue }
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Force -Id $_.OwningProcess -ErrorAction SilentlyContinue }
  L "select cron.alter_job(jobid, active := false) from cron.job" | Out-Null
  Start-Sleep 45

  Say "2/7 Copia dei dati del PC..."
  docker exec supabase-db sh -c "pg_dump -U postgres -d postgres -n public -Fc -f /tmp/pub.dump"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump fallito" }
  docker exec supabase-db sh -c "psql -U postgres -d postgres -qAtc 'select coalesce(json_agg(u), ''[]'') from auth.users u' > /tmp/users.json && psql -U postgres -d postgres -qAtc 'select coalesce(json_agg(i), ''[]'') from auth.identities i' > /tmp/idents.json"
  if ($LASTEXITCODE -ne 0) { throw "lettura utenti fallita" }
  docker cp supabase-db:/tmp/pub.dump (Join-Path $out "pub.dump") | Out-Null
  $countPc = @(L $countSql)
  $countPc | Set-Content -Encoding ascii (Join-Path $out "conteggi-pc.txt")
  Say ("   {0} tabelle, {1:N0} MB" -f $countPc.Count, ((Get-Item (Join-Path $out "pub.dump")).Length / 1MB))

  Say "3/7 Metto da parte il vecchio cloud e carico i dati (10-20 minuti)..."
  C "select cron.alter_job(jobid, active := false) from cron.job" | Out-Null
  C "alter schema public rename to $OLD; create schema public; grant usage on schema public to anon, authenticated, service_role; grant all on schema public to postgres, service_role; alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant all on sequences to anon, authenticated, service_role; alter default privileges in schema public grant all on functions to anon, authenticated, service_role;" | Out-Null
  $script:renamed = $true
  docker exec @cenv supabase-db sh -c "pg_restore --no-owner -d `$PGDATABASE /tmp/pub.dump 2> /tmp/restore.log; true"
  docker cp supabase-db:/tmp/restore.log (Join-Path $out "restore.log") | Out-Null
  Say "   avvisi del caricamento: $((Select-String -Path (Join-Path $out 'restore.log') -Pattern 'error' -SimpleMatch).Count) (dettagli in restore.log)"

  Say "4/7 Controllo che ogni tabella abbia le stesse righe del PC..."
  $countCloud = @(C $countSql)
  $diff = Compare-Object $countPc $countCloud
  if ($diff) { $diff | Format-Table | Out-String | Add-Content $log; $diff | Select-Object -First 15 | Format-Table | Out-Host; throw "i dati sul cloud non coincidono col PC" }
  Say "   tutte le $($countPc.Count) tabelle coincidono" Green

  Say "5/7 Utenti, regole, indirizzi delle foto..."
  docker cp (Join-Path $PSScriptRoot "cloud-dopo.sql") supabase-db:/tmp/cloud-dopo.sql | Out-Null
  CSh "psql -qAt -f /tmp/cloud-dopo.sql"
} catch {
  Say "ERRORE: $_" Red
  Ripristina-Cloud
  Riattiva-PC
  Say "Tutto rimesso come prima: il gioco gira ancora sul PC. Manda $log a Claude." Yellow
  exit 1
}

# --- da qui i dati sono sul cloud: un errore non fa piu' tornare indietro, si ripara
Say "6/7 Copio stemmi e foto..."
$anonLocal = (Get-Content (Join-Path $sb ".env") | Where-Object { $_ -match '^ANON_KEY=' }) -replace '^ANON_KEY=', ''
$cloudBuckets = @((Invoke-RestMethod -Headers $hdr "$CLOUD/storage/v1/bucket") | ForEach-Object { $_.id })
foreach ($b in @(L "select id||'|'||public::text from storage.buckets")) {
  $id, $pub = $b -split '\|'
  if ($cloudBuckets -notcontains $id) {
    Invoke-RestMethod -Method Post -Headers $hdr -ContentType "application/json" -Body (@{ id = $id; name = $id; public = ($pub -eq "true") } | ConvertTo-Json) "$CLOUD/storage/v1/bucket" | Out-Null
  }
}
$tmp = Join-Path $out "file.tmp"; $ok = 0; $ko = 0
foreach ($o in @(L "select bucket_id||'|'||name||'|'||coalesce(metadata->>'mimetype', 'application/octet-stream') from storage.objects")) {
  $bk, $name, $mime = $o -split '\|', 3
  $path = ($name -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
  try {
    Invoke-WebRequest -UseBasicParsing -Headers @{ apikey = $anonLocal; Authorization = "Bearer $anonLocal" } -OutFile $tmp "http://localhost:8000/storage/v1/object/public/$bk/$path"
    Invoke-WebRequest -UseBasicParsing -Method Post -Headers ($hdr + @{ "x-upsert" = "true" }) -ContentType $mime -InFile $tmp "$CLOUD/storage/v1/object/$bk/$path" | Out-Null
    $ok++
  } catch { $ko++; Add-Content $log "file non copiato: $bk/$name ($_)" }
}
Say "   file copiati: $ok, non copiati: $ko" $(if ($ko) { "Yellow" } else { "Green" })

Say "7/7 Accendo il motore del gioco sul cloud..."
docker cp (Join-Path $out "jobs.sql") supabase-db:/tmp/jobs.sql | Out-Null
docker exec @cenv supabase-db sh -c "psql -qAt -f /tmp/jobs.sql" | Out-Null
docker exec @cenv supabase-db psql -qAtc "vacuum (analyze)" 2>$null | Out-Null
Start-Sleep 75
$tick = C "select status||' '||round(extract(epoch from end_time-start_time)::numeric,1)||'s' from cron.job_run_details d join cron.job j using (jobid) where j.jobname='game-tick' order by runid desc limit 1"
Say "   ultimo giro del motore sul cloud: $tick" $(if ($tick -match 'succeeded') { "Green" } else { "Yellow" })

# PC: tutto fermo ma conservato
Disable-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Backup notturno" -ErrorAction SilentlyContinue | Out-Null
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"; if (Test-Path $ts) { & $ts funnel reset 2>$null }
Set-Location $sb; docker compose stop 2>$null | Out-Null
Say "FATTO: il gioco ora gira su Supabase cloud. Il database del PC e' fermo ma intatto. Avvisa Claude." Green
