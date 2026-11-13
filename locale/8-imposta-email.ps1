# Attiva le email del gioco (password dimenticata) sul server Oracle, usando una "password per le app" di Gmail.
$mail = (Read-Host "Scrivi l'indirizzo Gmail da cui partiranno le email e premi Invio").Trim()
$pw = (Read-Host "Incolla la password per le app di Google (16 lettere) e premi Invio").Trim()
$pw | ssh root@fantaserver "git -C /opt/fantasoccorritore/repo pull -q; bash /opt/fantasoccorritore/repo/server/imposta-email.sh '$mail'"
if ($LASTEXITCODE -eq 0) { Write-Host "FATTO: scrivi 'fatto' a Claude." -ForegroundColor Green }
else { Write-Host "Qualcosa non e' andato: scrivi a Claude." -ForegroundColor Yellow }
Read-Host "Premi Invio per chiudere"
