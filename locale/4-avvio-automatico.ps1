# Passo 4 (una volta sola): fa partire tutto da solo.
# - all'accesso a Windows: avvia il gioco (3-avvia-gioco.ps1)
# - ogni notte alle 04:00: backup del database (backup.ps1)
# - ogni domenica alle 05:00: pulizia del disco (pulizia.ps1)
# Per toglierli: Utilita' di pianificazione > cartella "FantaSoccorritore".
$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot
$user = "$env:USERDOMAIN\$env:USERNAME"
function TaskAction($script) {
  New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$(Join-Path $dir $script)`""
}
$common = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$logon.Delay = "PT1M"   # 1 minuto dopo l'accesso, per dare tempo a rete e Docker
$avvio = $common.Clone(); $avvio.ExecutionTimeLimit = "PT0S"   # nessun limite: resta acceso
Register-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Avvia gioco" -Action (TaskAction "3-avvia-gioco.ps1") -Trigger $logon -Settings $avvio -Principal $principal -Force | Out-Null

Register-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Backup notturno" -Action (TaskAction "backup.ps1") -Trigger (New-ScheduledTaskTrigger -Daily -At 04:00) -Settings $common -Principal $principal -Force | Out-Null

Register-ScheduledTask -TaskPath "\FantaSoccorritore\" -TaskName "Pulizia disco" -Action (TaskAction "pulizia.ps1") -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 05:00) -Settings $common -Principal $principal -Force | Out-Null

Write-Host "Fatto: il gioco partira' da solo a ogni accesso, backup ogni notte, pulizia ogni domenica." -ForegroundColor Green
