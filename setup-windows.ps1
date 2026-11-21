# Windows setup for econ-harness.
#
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1 [-SkipInstall] [-SkipR] [-Offline] [-NoPrompt]
#
#   -SkipInstall  do not install software; only configure, build and verify
#   -SkipR        do not install R packages
#   -Offline      skip the MCP protocol test (needs network)
#   -NoPrompt     never ask; use existing environment variables and skip optional installs
#
# Safe to rerun. Software that is already installed is left alone. API keys are saved as
# Windows user environment variables, never in the repository.
#
# Keep this file ASCII-only: Windows PowerShell 5.1 misreads UTF-8 without a BOM.

param(
  [switch]$SkipInstall,
  [switch]$SkipR,
  [switch]$Offline,
  [switch]$NoPrompt
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Say($msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Has($cmd)  { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Confirm-Step($question) {
  if ($NoPrompt) { return $false }
  return (Read-Host "$question [Y/n]") -notmatch '^[nN]'
}

function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Add-UserPath($dir) {
  if (-not (Test-Path $dir)) { return }
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @("$user".Split(';') | Where-Object { $_ })
  if ($parts -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', (($parts + $dir) -join ';'), 'User')
    Say "Added to user PATH: $dir"
  }
  Update-SessionPath
}

# The R installer does not put Rscript on PATH. Add the newest installed R\bin, if any.
function Add-RToPath {
  if (Has 'Rscript') { return }
  $latest = Get-ChildItem "$env:ProgramFiles\R" -Directory -Filter 'R-*' -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.Name -replace '^R-', '') } -Descending |
    Select-Object -First 1
  if ($latest) { Add-UserPath (Join-Path $latest.FullName 'bin') }
}

function Test-WingetInstalled($id) {
  winget list --id $id -e --accept-source-agreements *> $null
  return $LASTEXITCODE -eq 0
}

# Install a winget package unless one of the probe commands already works or winget
# already knows about it (installed but not on PATH, or installed without a command).
function Install-Package($id, [string[]]$probes = @()) {
  foreach ($p in $probes) {
    if (Has $p) { Say "${id}: already installed ($p found)"; return }
  }
  if (Test-WingetInstalled $id) { Say "${id}: already installed"; return }
  Say "Installing $id"
  winget install --id $id -e --source winget --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Warn "winget could not install $id (exit $LASTEXITCODE). Install it manually." }
  Update-SessionPath
}

# Orca is not on winget; it ships as an installer on GitHub releases.
function Install-Orca {
  $known = @(
    "$env:LOCALAPPDATA\Programs\Orca\Orca.exe",
    "$env:ProgramFiles\Orca\Orca.exe"
  )
  if ((Has 'orca') -or ($known | Where-Object { Test-Path $_ })) { Say 'Orca: already installed'; return }
  if (-not (Confirm-Step 'Orca not found. Download and install it now?')) { return }
  $url = 'https://github.com/stablyai/orca/releases/latest/download/orca-windows-setup.exe'
  $exe = Join-Path $env:TEMP 'orca-windows-setup.exe'
  Say "Downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
  Start-Process -FilePath $exe -ArgumentList '/S' -Wait
  Remove-Item $exe -ErrorAction SilentlyContinue
  Say 'Orca installed. Start it once from the Start menu.'
}

# --- 1. Software ------------------------------------------------------------------------------
Add-RToPath
if (-not $SkipInstall) {
  if (-not (Has 'winget')) { throw 'winget not found. Install "App Installer" from the Microsoft Store, then rerun.' }
  Install-Package 'Git.Git'           @('git')
  Install-Package 'OpenJS.NodeJS.LTS' @('node')
  Install-Package 'RProject.R'        @('Rscript')
  Install-Package 'Posit.RStudio'
  Install-Package 'Posit.Quarto'      @('quarto')
  Install-Package 'Python.Python.3.12' @('py', 'python')
  # Rtools builds R packages from source (fwildclusterboot and other GitHub packages).
  if (-not (Test-Path 'C:\rtools4*')) { Install-Package 'RProject.Rtools' }
  Add-RToPath
  Install-Orca
}
if (-not (Has 'Rscript')) { Warn 'Rscript still not found. Install R 4.6 and add its bin folder to PATH.' }

if (-not (Has 'claude') -and (Confirm-Step 'Claude Code not found. Install it now?')) {
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  Add-UserPath (Join-Path $env:USERPROFILE '.local\bin')
}

# --- 2. Environment variables (user scope) ------------------------------------------------------
$econRoot = $Root -replace '\\', '/'
[Environment]::SetEnvironmentVariable('ECON_ROOT', $econRoot, 'User')
$env:ECON_ROOT = $econRoot
Say "ECON_ROOT = $econRoot"

$keys = @(
  @{ Name = 'OPENALEX_EMAIL';           Hint = 'email for the OpenAlex polite pool (recommended)' },
  @{ Name = 'SEMANTIC_SCHOLAR_API_KEY'; Hint = 'Semantic Scholar API key (optional)' },
  @{ Name = 'ELSEVIER_API_KEY';         Hint = 'Elsevier API key from dev.elsevier.com (optional)' }
)
foreach ($k in $keys) {
  $value = [Environment]::GetEnvironmentVariable($k.Name, 'User')
  if (-not $value -and -not $NoPrompt) {
    $value = (Read-Host "$($k.Name) - $($k.Hint). Press Enter to skip").Trim()
    if ($value) { [Environment]::SetEnvironmentVariable($k.Name, $value, 'User') }
  }
  if ($value) { Set-Item -Path "Env:$($k.Name)" -Value $value; Say "$($k.Name) is set" }
  else { Warn "$($k.Name) is not set" }
}

# --- 3. Build, register and verify (shared with macOS) -------------------------------------------
if (-not (Has 'node')) { throw 'node not found on PATH. Open a NEW PowerShell window and rerun this script.' }
$setupArgs = @()
if ($SkipR)   { $setupArgs += '--skip-r' }
if ($Offline) { $setupArgs += '--offline' }
& node (Join-Path $Root 'harness\setup\setup.mjs') @setupArgs
$setupExit = $LASTEXITCODE

# --- 4. Register the workspace in Orca -----------------------------------------------------------
if (Has 'orca') {
  & orca repo add --path $Root --json | Out-Null
  if ($LASTEXITCODE -eq 0) { Say 'Workspace added to Orca' }
  else { Warn 'orca repo add failed. In Orca: Add repository -> select this folder.' }
} else {
  Warn 'orca CLI not on PATH. In Orca: Add repository -> select this folder.'
}

if ($setupExit -ne 0) {
  Write-Host 'Setup finished with failures (see the summary above). Fix them and rerun.' -ForegroundColor Red
  exit $setupExit
}
Write-Host 'Setup complete. Open a NEW terminal so the PATH and environment changes apply.' -ForegroundColor Green
