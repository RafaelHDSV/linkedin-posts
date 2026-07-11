$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
  throw "Yarn não foi encontrado no PATH. Instale o Node.js/Yarn ou ajuste o PATH da tarefa."
}

& yarn scrape:on-logon
exit $LASTEXITCODE
