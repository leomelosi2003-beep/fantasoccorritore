# Riavvio completo del gioco (da usare se il sito non si vede da fuori).
# Si lancia col doppio clic su "Riavvia FantaSoccorritore" sul Desktop.
# 1) ricollega la Wi-Fi  2) riaccende il tunnel Tailscale  3) chiude e riapre il gioco (database + sito)
# Non tocca i dati di gioco.
$ErrorActionPreference = "Continue"
Write-Host "== Riavvio FantaSoccorritore ==" -ForegroundColor Cyan

# 1) Wi-Fi
$rete = (netsh wlan show profiles | Select-String ':\s*(.+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() } | Select-Object -First 1)
if ($rete) { Write-Host "Ricollego la Wi-Fi '$rete'..."; netsh wlan connect name="$rete" | Out-Null; Start-Sleep 10 }
$ok = $false
foreach ($i in 1..6) {
  try { $c = New-Object Net.Sockets.TcpClient; if ($c.ConnectAsync("1.1.1.1", 443).Wait(5000) -and $c.Connected) { $ok = $true }; $c.Close() } catch {}
  if ($ok) { break }; Start-Sleep 5
}
if (-not $ok) {
  Write-Host "Internet ancora assente. Controlla il modem, oppure stacca e riattacca la chiavetta Wi-Fi USB, poi rilancia questo file." -ForegroundColor Red
  Read-Host "Premi Invio per chiudere"; exit 1
}
Write-Host "Internet OK" -ForegroundColor Green

# 2) Tailscale
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"
if (Test-Path $ts) { & $ts up *> $null; & $ts funnel --bg 3000 *> $null; Write-Host "Tunnel Tailscale OK" -ForegroundColor Green }

# 3) Gioco: chiudo la finestra vecchia e la riapro (rifa' anche il sito)
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match '3-avvia-gioco' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-ScheduledTask -TaskPath '\FantaSoccorritore\' -TaskName 'Avvia gioco'
Write-Host "Riavvio il gioco: aspetta 2-3 minuti..." -ForegroundColor Cyan
foreach ($i in 1..30) {
  Start-Sleep 10
  try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "http://localhost:3000/api/version").StatusCode -eq 200) {
    Write-Host "FATTO: il gioco e' online su https://desktop-f0qb534.tail9a3baf.ts.net" -ForegroundColor Green; Start-Sleep 8; exit 0 } } catch {}
}
Write-Host "Il sito non risponde ancora. Riprova tra qualche minuto o riavvia il PC." -ForegroundColor Red
Read-Host "Premi Invio per chiudere"
