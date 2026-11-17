# =============================================================================
# XenoCare Server setup (Windows)
#
# Run in an elevated PowerShell from the installed folder:
#   powershell -NoProfile -ExecutionPolicy Bypass `
#     -File .\scripts\server\install-server.ps1
#
# Requirements: Docker Desktop installed and running (WSL 2 backend).
# Logs: C:\ProgramData\XenoCare\install.log
# =============================================================================
[CmdletBinding()]
param(
  [int]$WebPort = 8080,
  [int]$DelaySeconds = 30,
  [switch]$SkipFirewall,
  [switch]$SkipTask,
  [switch]$SkipStart
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Node = Join-Path $Root 'node\node.exe'
$Supabase = Join-Path $Root 'bin\supabase.exe'
$WebScript = Join-Path $Root 'scripts\server\web-server.mjs'
$WebRoot = Join-Path $Root 'web'
$LogDir = Join-Path $env:ProgramData 'XenoCare'
$LogFile = Join-Path $LogDir 'install.log'
$ErrorFile = Join-Path $LogDir 'last-error.txt'
$values = @{}

function Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Show-Failure([string]$Message) {
  Write-Host ''
  Write-Host 'XenoCare server setup failed:' -ForegroundColor Red
  Write-Host $Message -ForegroundColor Red
  Write-Host "Log: $LogFile"
  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "$Message`n`nLog file:`n$LogFile",
      'XenoCare Server setup',
      'OK',
      'Error'
    ) | Out-Null
  } catch {
    # No GUI available (e.g. remote shell): the log is enough.
  }
}

function Resolve-Docker {
  $candidates = @()
  $cmd = Get-Command docker.exe -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  $candidates += @(
    "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\resources\bin\docker.exe",
    "$env:ProgramData\DockerDesktop\version-bin\docker.exe",
    "$env:LOCALAPPDATA\Docker\Docker\resources\bin\docker.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Get-LanIp {
  try {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
      } |
      Select-Object -ExpandProperty IPAddress
    return @($addresses)[0]
  } catch {
    return $null
  }
}

try {
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  Start-Transcript -Path $LogFile -Append | Out-Null

  Step "XenoCare server setup"
  Write-Host "Install folder: $Root"
  Write-Host "Log: $LogFile"

  foreach ($file in @($Node, $Supabase, $WebScript, $WebRoot)) {
    if (-not (Test-Path $file)) {
      throw "Required server file is missing: $file"
    }
  }

  $env:PATH = "$Root\node;$Root\bin;$env:PATH"
  $env:SUPABASE_BIN = $Supabase

  Step 'Locating Docker Desktop'
  $docker = Resolve-Docker
  if (-not $docker) {
    throw 'Docker Desktop is not installed (docker.exe was not found). Install Docker Desktop with the WSL 2 backend, then run this setup again.'
  }
  $env:PATH = "$(Split-Path -Parent $docker);$env:PATH"
  $env:DOCKER_BIN = $docker
  Write-Host "Docker CLI: $docker"

  Step 'Waiting for the Docker engine'
  $dockerOk = $false
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    & $docker info *> $null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
    Start-Sleep -Seconds 4
  }
  if (-not $dockerOk) {
    & $docker info 2>&1 | Out-File -FilePath (Join-Path $LogDir 'docker-info.txt') -Encoding utf8
    throw "Docker Desktop is installed but its engine is not responding. Open Docker Desktop, wait until it says 'Engine running', then run this setup again. Details: $LogDir\docker-info.txt"
  }

  Step "Bundled Supabase CLI"
  & $Supabase --version | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "The bundled Supabase CLI could not run. Details: $LogFile"
  }

  Step 'Starting the XenoCare database (first run may pull images)'
  Push-Location $Root
  try {
    $provisionLog = Join-Path $LogDir 'provision.log'
    & $Node (Join-Path $Root 'scripts\local-db\provision.mjs') --if-empty 2>&1 |
      Tee-Object -FilePath $provisionLog -Append | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Database provisioning failed. See $LogFile"
    }

    Step 'Reading server keys'
    $status = & $Supabase status -o env 2>&1
    foreach ($line in $status) {
      if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') {
        $values[$Matches[1]] = $Matches[2]
      }
    }
    if (-not $values['API_URL'] -or -not $values['ANON_KEY']) {
      throw "Could not read the Supabase API URL / anon key. See $LogFile"
    }

    $envText = @(
      "SUPABASE_URL=$($values['API_URL'])",
      "SUPABASE_ANON_KEY=$($values['ANON_KEY'])",
      "SUPABASE_SERVICE_ROLE_KEY=$($values['SERVICE_ROLE_KEY'])"
    ) -join "`r`n"
    Set-Content -Path (Join-Path $Root '.env') -Value $envText -Encoding utf8
  } finally {
    Pop-Location
  }

  $isAdmin = Test-Admin
  if (-not $isAdmin) {
    Write-Warning 'Not elevated: firewall and startup-task changes are skipped.'
  }

  if (-not $SkipFirewall -and $isAdmin) {
    Step 'Opening the Windows firewall (private networks)'
    foreach ($port in @($WebPort, 54321, 54323)) {
      $name = "XenoCare Server ($port)"
      try {
        if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
          New-NetFirewallRule `
            -DisplayName $name `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $port `
            -Profile Private | Out-Null
        }
      } catch {
        Write-Warning "Could not add firewall rule for port $port`: $($_.Exception.Message)"
      }
    }
  }

  if (-not $SkipTask -and $isAdmin) {
    Step 'Registering start-at-sign-in task'
    try {
      $action = New-ScheduledTaskAction `
        -Execute $Node `
        -Argument "`"$WebScript`" --port $WebPort --root `"$WebRoot`"" `
        -WorkingDirectory $Root
      $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
      try { $trigger.Delay = "PT${DelaySeconds}S" } catch { }
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
        -TaskName 'XenoCare Web Server' `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description 'Serves the XenoCare browser app on the LAN.' `
        -Force | Out-Null
    } catch {
      Write-Warning "Could not register the startup task: $($_.Exception.Message)"
    }
  }

  $lanIp = Get-LanIp
  $lanUrl = if ($lanIp) { "http://${lanIp}:$WebPort" } else { "http://<server-ip>:$WebPort" }

  if (-not $SkipStart) {
    Step "Starting the web server on port $WebPort"
    $arguments = @("`"$WebScript`"", '--port', "$WebPort", '--root', "`"$WebRoot`"")
    Start-Process -FilePath $Node -ArgumentList $arguments -WorkingDirectory $Root -WindowStyle Hidden
    Start-Sleep -Seconds 3
  }

  $lines = @(
    'XenoCare server',
    "Updated: $(Get-Date -Format o)",
    '',
    "Web app (this PC): http://127.0.0.1:$WebPort",
    "Web app (LAN):     $lanUrl",
    "API (LAN):         http://${lanIp}:54321",
    '',
    'On each client device:',
    "  Open a browser at $lanUrl",
    '',
    'Anon key (only needed for the desktop app):',
    $values['ANON_KEY'],
    ''
  )
  $infoDir = Join-Path $env:USERPROFILE 'XenoCare'
  New-Item -ItemType Directory -Force -Path $infoDir | Out-Null
  $infoFile = Join-Path $infoDir 'server-info.txt'
  Set-Content -Path $infoFile -Value ($lines -join "`r`n") -Encoding utf8

  if (Test-Path $ErrorFile) { Remove-Item $ErrorFile -Force }

  Write-Host ''
  Write-Host 'XenoCare server is running.' -ForegroundColor Green
  Write-Host "  Web app : $lanUrl"
  Write-Host "  API     : http://${lanIp}:54321"
  Write-Host "  Details : $infoFile"
  Write-Host ''
  Write-Host 'Clients only need the web address in a browser.'
} catch {
  $message = $_.Exception.Message
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  Set-Content -Path $ErrorFile -Value $message -Encoding utf8
  Show-Failure $message
  exit 1
} finally {
  try { Stop-Transcript | Out-Null } catch { }
}
