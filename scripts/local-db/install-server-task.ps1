# =============================================================================
# XenoCare - one-time Windows server setup
#
# Run in an elevated PowerShell (Run as Administrator):
#
#   powershell -NoProfile -ExecutionPolicy Bypass `
#     -File .\scripts\local-db\install-server-task.ps1
#
# It will:
#   1. Open Windows Firewall for the LAN ports (54321 API, 54323 Studio).
#   2. Register a "XenoCare Server" task that starts the stack at sign-in.
#   3. Start the stack + provision the database now and print the join details.
#
# Docker Desktop must be installed (WSL 2 backend) and running.
# =============================================================================
[CmdletBinding()]
param(
  [string]$TaskName = 'XenoCare Server',
  [int]$DelaySeconds = 45,
  [switch]$SkipFirewall,
  [switch]$SkipStart,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$hostScript = Join-Path $root 'scripts\local-db\host-server.mjs'
if (-not (Test-Path $hostScript)) {
  throw "host-server.mjs not found at $hostScript. Run this from the XenoCare repository."
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'Node.js was not found on PATH. Install Node.js 20 LTS, then re-run this script.'
}
$node = $nodeCommand.Source

Write-Step "Repository: $root"
Write-Step "Node: $node"

# ---------------------------------------------------------------------------
# 1. Windows Firewall (LAN only)
# ---------------------------------------------------------------------------
if (-not $SkipFirewall) {
  if (Test-Admin) {
    Write-Step 'Allowing inbound TCP 54321/54323 on private networks'
    foreach ($port in 54321, 54323) {
      $ruleName = "XenoCare Server ($port)"
      if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule `
          -DisplayName $ruleName `
          -Direction Inbound `
          -Action Allow `
          -Protocol TCP `
          -LocalPort $port `
          -Profile Private | Out-Null
        Write-Host "    Added firewall rule: $ruleName"
      } else {
        Write-Host "    Firewall rule already exists: $ruleName"
      }
    }
  } else {
    Write-Warning 'Not elevated: firewall rules were not added.'
    Write-Warning 'Re-run this script as Administrator, or add them manually:'
    Write-Warning '  New-NetFirewallRule -DisplayName "XenoCare Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 54321,54323 -Profile Private'
  }
}

# ---------------------------------------------------------------------------
# 2. Start-at-sign-in scheduled task
# ---------------------------------------------------------------------------
Write-Step "Registering scheduled task '$TaskName'"

$action = New-ScheduledTaskAction `
  -Execute $node `
  -Argument "`"$hostScript`" --wait --provision" `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
try {
  $trigger.Delay = "PT${DelaySeconds}S"
} catch {
  Write-Warning "Could not set the logon delay; the task will start immediately at sign-in."
}

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Starts the local XenoCare database/server at sign-in.' `
  -Force | Out-Null

Write-Host "    Registered. It runs at sign-in after ${DelaySeconds}s."

# ---------------------------------------------------------------------------
# 3. Docker Desktop auto-start check
# ---------------------------------------------------------------------------
$dockerAutoStart = $false
try {
  $runKey = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction Stop
  $dockerAutoStart = @($runKey.PSObject.Properties.Name) -match 'Docker Desktop' | Select-Object -First 1
} catch {
  $dockerAutoStart = $false
}

if (-not $dockerAutoStart) {
  Write-Warning 'Docker Desktop is not set to start at sign-in.'
  Write-Warning 'Enable Settings > General > "Start Docker Desktop when you sign in",'
  Write-Warning 'or the XenoCare task will wait for Docker and time out.'
}

# ---------------------------------------------------------------------------
# 4. Start now, provision if empty, and print the join details
# ---------------------------------------------------------------------------
if (-not $SkipStart) {
  Write-Step 'Starting the stack and checking the database'
  Push-Location $root
  try {
    & $node $hostScript --provision
    if ($LASTEXITCODE -ne 0) {
      throw "host-server.mjs exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host 'XenoCare server setup complete.' -ForegroundColor Green
Write-Host 'Join details were printed above and saved to:'
Write-Host "  $env:USERPROFILE\XenoCare\server-info.txt"

if (-not $NoPause) {
  Read-Host 'Press Enter to close' | Out-Null
}
