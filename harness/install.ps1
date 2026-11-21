$ErrorActionPreference = 'Stop'
$H = Split-Path -Parent $MyInvocation.MyCommand.Path
$A = Join-Path $env:USERPROFILE '.omp\agent'
Copy-Item "$H\commands\ae-*.md" "$A\commands\" -Force
Copy-Item "$H\agents\ae-*.md" "$A\agents\" -Force
Copy-Item "$H\extensions\ae-raw-guard.ts" "$A\extensions\" -Force
Get-ChildItem "$A\commands\ae-*.md","$A\agents\ae-*.md","$A\extensions\ae-raw-guard.ts" | Select-Object -ExpandProperty Name
