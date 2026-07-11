@echo off
setlocal
cd /d "%~dp0"

echo ===== Node =====
where node

echo.
echo ===== Active IPv4 addresses =====
ipconfig | findstr /C:"IPv4 Address"

echo.
for /f %%P in ('powershell -NoProfile -Command "(Get-Content -Raw '.\app-settings.json' | ConvertFrom-Json).udpPort"') do set F1PORT=%%P
echo ===== UDP listener for port %F1PORT% =====
netstat -ano -p udp | findstr ":%F1PORT%"

echo.
echo ===== Matching firewall rule =====
powershell -NoProfile -Command "Get-NetFirewallRule -DisplayName 'F1 Fantasy Node UDP' -ErrorAction SilentlyContinue | Format-Table DisplayName,Enabled,Profile,Direction,Action -AutoSize"

echo.
echo PS5 should use the PC IPv4 address above and UDP port %F1PORT%.
pause
