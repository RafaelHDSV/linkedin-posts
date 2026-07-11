$ErrorActionPreference = "Stop"

$taskName = "LinkedIn Posts - Coleta no logon"
$scriptPath = Join-Path $PSScriptRoot "scrape-on-logon.ps1"
$userId = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $scriptPath)) {
  throw "Script de coleta não encontrado: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Valida a sessão LinkedIn no logon e abre login manual apenas quando a sessão expira." `
  -Force | Out-Null

Write-Host "Tarefa '$taskName' registrada para o usuário $userId."
