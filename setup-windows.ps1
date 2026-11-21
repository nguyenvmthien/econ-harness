# Econ harness - Windows bootstrap (ASCII only: Windows PowerShell 5.1 safe).
#
# Run from the cloned repository root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
# Options:
#   -SkipInstall   do not install software with winget (only configure + build + verify)
#   -SkipR         do not install R packages
#   -Offline       skip the network MCP protocol test
#   -NoPrompt      do not ask for API keys / confirmations (use existing env vars)
#
# Safe to rerun. API keys are stored as Windows *user* environment variables, never in the repo.
param(
  [switch]$SkipInstall,
  [switch]$SkipR,
  [switch]$Offline,
  [switch]$NoPrompt
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Say($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Add-UserPath($dir) {
  if (-not (Test-Path $dir)) { return }
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $user) { $user = '' }
  $parts = $user.Split(';') | Where-Object { $_ -ne '' }
  if ($parts -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', (($parts + $dir) -join ';'), 'User')
    Say "Added to user PATH: $dir"
  }
  Refresh-Path
}

function Winget-Install($id, $probe) {
  if ($probe -and (Has $probe)) { Say "$id already installed ($probe found)"; return }
  Say "winget install $id"
  winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { Warn "winget could not install $id (exit $LASTEXITCODE). Install it manually." }
  Refresh-Path
}

# --- 1. Software -------------------------------------------------------------------------------
if (-not $SkipInstall) {
  if (-not (Has 'winget')) { throw 'winget not found. Install "App Installer" from Microsoft Store, then rerun.' }
  Winget-Install 'Git.Git' 'git'
  Winget-Install 'OpenJS.NodeJS.LTS' 'node'
  Winget-Install 'RProject.R' 'Rscript'
  Winget-Install 'Posit.RStudio' $null
  Winget-Install 'Posit.Quarto' 'quarto'
  Winget-Install 'JohnMacFarlane.Pandoc' 'pandoc'
  Winget-Install 'Python.Python.3.12' 'py'
  # Rtools: needed to build R packages from source (fwildclusterboot, GitHub packages).
  if (-not (Test-Path 'C:\rtools4*')) { Winget-Install 'RProject.Rtools' $null }
}

# R's installer does not put Rscript on PATH: add the newest R bin directory.
if (-not (Has 'Rscript')) {
  $rbin = Get-ChildItem "$env:ProgramFiles\R" -Directory -Filter 'R-*' -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.Name -replace '^R-', '') } -Descending | Select-Object -First 1
  if ($rbin) { Add-UserPath (Join-Path $rbin.FullName 'bin') }
}
if (-not (Has 'Rscript')) { Warn 'Rscript still not found. Install R 4.6.x and add its bin folder to PATH.' }

# Claude Code (default agent in Orca). Native installer from Anthropic.
if (-not (Has 'claude')) {
  $ok = $NoPrompt
  if (-not $NoPrompt) { $ok = (Read-Host 'Claude Code not found. Install it now? [Y/n]') -notmatch '^[nN]' }
  if ($ok) {
    Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
    Add-UserPath (Join-Path $env:USERPROFILE '.local\bin')
  }
}

# --- 2. Environment variables (user scope) -------------------------------------------------------
[Environment]::SetEnvironmentVariable('ECON_ROOT', ($Root -replace '\\', '/'), 'User')
$env:ECON_ROOT = ($Root -replace '\\', '/')
Say "ECON_ROOT = $env:ECON_ROOT"

$keys = @(
  @{ Name = 'OPENALEX_EMAIL'; Hint = 'email for the OpenAlex polite pool (recommended)' },
  @{ Name = 'SEMANTIC_SCHOLAR_API_KEY'; Hint = 'Semantic Scholar API key (optional)' },
  @{ Name = 'ELSEVIER_API_KEY'; Hint = 'Elsevier API key from dev.elsevier.com (optional)' }
)
foreach ($k in $keys) {
  $current = [Environment]::GetEnvironmentVariable($k.Name, 'User')
  if (-not $current -and -not $NoPrompt) {
    $value = Read-Host "$($k.Name) - $($k.Hint). Enter to skip"
    if ($value) {
      [Environment]::SetEnvironmentVariable($k.Name, $value.Trim(), 'User')
      $current = $value.Trim()
    }
  }
  if ($current) { Set-Item -Path "Env:$($k.Name)" -Value $current; Say "$($k.Name) is set" }
  else { Warn "$($k.Name) not set" }
}

# --- 3. Build, register, verify (shared with macOS) -------------------------------------------
if (-not (Has 'node')) { throw 'node not found on PATH. Open a NEW PowerShell window and rerun this script.' }
$setupArgs = @()
if ($SkipR) { $setupArgs += '--skip-r' }
if ($Offline) { $setupArgs += '--offline' }
& node (Join-Path $Root 'harness\setup\setup.mjs') @setupArgs
$setupExit = $LASTEXITCODE

# --- 4. Orca (optional) ---------------------------------------------------------------------------
if (Has 'orca') {
  Say 'Registering this folder in Orca'
  & orca repo add --path $Root --json | Out-Null
  if ($LASTEXITCODE -ne 0) { Warn 'orca repo add failed; add the folder from the Orca app instead.' }
} else {
  Warn 'orca CLI not on PATH. In the Orca app: Add repository -> select this folder.'
}

if ($setupExit -ne 0) {
  Write-Host 'Setup finished with failures (see summary above). Fix them and rerun this script.' -ForegroundColor Red
  exit $setupExit
}
Write-Host 'Setup complete. Open a NEW terminal so PATH/env changes apply everywhere.' -ForegroundColor Green
