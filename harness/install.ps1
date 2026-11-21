# Install the econ harness into omp (optional; Claude Code does not need this).
#
#   powershell -ExecutionPolicy Bypass -File harness\install.ps1
#
# Copies the ae-* commands, agents and the raw-data guard extension into %USERPROFILE%\.omp\agent.
# Skills are picked up through .omp/config.yml, which harness/setup/setup.mjs writes.

$ErrorActionPreference = 'Stop'
$harness = Split-Path -Parent $MyInvocation.MyCommand.Path
$ompAgent = Join-Path $env:USERPROFILE '.omp\agent'

foreach ($sub in 'commands', 'agents', 'extensions') {
  New-Item -ItemType Directory -Force -Path (Join-Path $ompAgent $sub) | Out-Null
}
Copy-Item "$harness\commands\ae-*.md"         "$ompAgent\commands\"   -Force
Copy-Item "$harness\agents\ae-*.md"           "$ompAgent\agents\"     -Force
Copy-Item "$harness\extensions\ae-raw-guard.ts" "$ompAgent\extensions\" -Force

Write-Host "Installed into $ompAgent :"
Get-ChildItem "$ompAgent\commands\ae-*.md", "$ompAgent\agents\ae-*.md", "$ompAgent\extensions\ae-raw-guard.ts" |
  ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host 'The guard applies to every data/raw folder unless ECON_ROOT (set by setup-windows.ps1) limits it to this workspace.'
