@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo  F1 25 Fantasy Live

echo  Node executable:
where node 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js was not found. Install Node.js and reopen this file.
  pause
  exit /b 1
)

for /f %%P in ('powershell -NoProfile -Command "(Get-Content -Raw '.\app-settings.json' | ConvertFrom-Json).udpPort"') do set F1PORT=%%P
set PORTPID=
for /f "tokens=4" %%A in ('netstat -ano -p udp ^| findstr ":%F1PORT%"') do set PORTPID=%%A
if defined PORTPID (
  echo.
  echo ERROR: UDP port %F1PORT% is already being used by PID %PORTPID%.
  tasklist /FI "PID eq %PORTPID%"
  echo.
  echo Close the old telemetry app/process, or change the port in app-settings.json.
  pause
  exit /b 1
)

echo.
echo Starting the dashboard and UDP receiver on port %F1PORT%...
echo Keep this window open while using F1 25.
echo.
node server.js

echo.
echo The app stopped. Review any error shown above.
pause
