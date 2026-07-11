@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Requesting Administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$node=(Get-Command node).Source;" ^
  "$settings=Get-Content -Raw '.\app-settings.json' | ConvertFrom-Json;" ^
  "$port=[int]$settings.udpPort;" ^
  "Get-NetFirewallRule -DisplayName 'F1 Fantasy Node UDP' -ErrorAction SilentlyContinue | Remove-NetFirewallRule;" ^
  "New-NetFirewallRule -DisplayName 'F1 Fantasy Node UDP' -Direction Inbound -Action Allow -Protocol UDP -LocalPort $port -Program $node -Profile Private | Out-Null;" ^
  "Write-Host ('Allowed ' + $node + ' to receive Private-network UDP on port ' + $port) -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo The firewall rule could not be created.
) else (
  echo.
  echo Firewall setup completed.
)
pause
