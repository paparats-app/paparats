<#
.SYNOPSIS
  Checks Paparats on a clean Windows: Windows Sandbox (Windows 11 Pro/Enterprise).

.DESCRIPTION
  Builds the catalog bot, starts a fresh Windows Sandbox with the catalog repository mapped
  read-only, and inside it:
    1. downloads the latest Paparats release from GitHub, installs it silently and reads the
       installed version back;
    2. runs the catalog's smoke install with the client's own code for the chosen apps:
       install (and update from the previous release), found by the inventory, something for
       "Open" to start, uninstall.
  The report lands in <Out>\sandbox.md. The Sandbox is discarded when its window is closed.

  Windows Sandbox must be enabled once, from an elevated PowerShell, then reboot:
    Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All

.EXAMPLE
  pwsh scripts/sandbox-check.ps1
  pwsh scripts/sandbox-check.ps1 -Only rufus,obsidian,seelen-ui
#>
param(
  # The local clone of paparats-app/catalog.
  [string]$Catalog = (Join-Path $PSScriptRoot '..\..\Paparats-catalog'),
  # Catalog app ids to check; empty = every app (about two hours).
  [string[]]$Only = @('rufus', 'keepassxc', 'obsidian', 'audacity', 'flow-launcher', 'seelen-ui', 'localsend'),
  # Where the report and the Sandbox configuration go on this PC.
  [string]$Out = (Join-Path $env:TEMP 'paparats-sandbox'),
  # How long to wait for the Sandbox to finish.
  [int]$TimeoutMinutes = 180
)
$ErrorActionPreference = 'Stop'

$sandbox = Join-Path $env:windir 'System32\WindowsSandbox.exe'
if (-not (Test-Path $sandbox)) {
  throw @"
Windows Sandbox is not enabled. From an elevated PowerShell run
  Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All
then reboot and run this script again.
"@
}
$Catalog = (Resolve-Path $Catalog).Path
if (-not (Test-Path (Join-Path $Catalog 'lock.json'))) { throw "$Catalog is not a catalog clone (no lock.json)" }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repo
try {
  cargo build --release --locked -p paparats-catalog-bot
  if ($LASTEXITCODE) { throw 'building the catalog bot failed' }
} finally { Pop-Location }

$kit = Join-Path $Out 'kit'
$results = Join-Path $Out 'results'
Remove-Item -Recurse -Force $Out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $kit, $results | Out-Null
Copy-Item (Join-Path $repo 'target\release\catalog-bot.exe') $kit

$onlyArgs = ($Only | ForEach-Object { "'--only', '$_'" }) -join ', '
@"
`$ErrorActionPreference = 'Continue'
`$report = 'C:\results\sandbox.md'
"# Paparats on a clean Windows Sandbox``n``n" + (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + [Environment]::OSVersion.Version + "``n" | Set-Content `$report
try {
  `$release = Invoke-RestMethod 'https://api.github.com/repos/paparats-app/paparats/releases/latest'
  `$asset = `$release.assets | Where-Object name -like '*_x64-setup.exe' | Select-Object -First 1
  Invoke-WebRequest `$asset.browser_download_url -OutFile C:\setup.exe
  `$p = Start-Process C:\setup.exe -ArgumentList '/S' -Wait -PassThru
  `$entry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object DisplayName -eq 'Paparats'
  "``n## Paparats `$(`$release.tag_name)``n``nInstaller exit code `$(`$p.ExitCode); installed version: `$(`$entry.DisplayVersion)``n" | Add-Content `$report
} catch { "``n## Paparats``n``nFailed: `$_``n" | Add-Content `$report }
& C:\kit\catalog-bot.exe smoke C:\catalog --summary C:\results\smoke.md $( if ($Only) { "@($onlyArgs)" } )
Get-Content C:\results\smoke.md -ErrorAction SilentlyContinue | Add-Content `$report
'done' | Set-Content C:\results\done.txt
"@ | Set-Content -Encoding utf8 (Join-Path $kit 'run.ps1')

$wsb = Join-Path $Out 'paparats.wsb'
@"
<Configuration>
  <Networking>Enable</Networking>
  <MappedFolders>
    <MappedFolder><HostFolder>$kit</HostFolder><SandboxFolder>C:\kit</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$Catalog</HostFolder><SandboxFolder>C:\catalog</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$results</HostFolder><SandboxFolder>C:\results</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\kit\run.ps1</Command>
  </LogonCommand>
</Configuration>
"@ | Set-Content -Encoding utf8 $wsb

Write-Host "Starting Windows Sandbox ($wsb); results go to $results"
Start-Process $sandbox -ArgumentList "`"$wsb`""
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while (-not (Test-Path (Join-Path $results 'done.txt'))) {
  if ((Get-Date) -gt $deadline) { throw "no result after $TimeoutMinutes minutes; see $results" }
  Start-Sleep -Seconds 15
}
Get-Content (Join-Path $results 'sandbox.md')
Write-Host "`nClose the Sandbox window to discard it. Report: $(Join-Path $results 'sandbox.md')"
