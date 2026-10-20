@echo off
setlocal
cd /d "%~dp0"

set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" (
  echo Node.js was not found at:
  echo %NODE%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }" >nul 2>&1

echo Starting EVOL DREAM frontend...
echo Open: http://127.0.0.1:4173/zh/
echo Keep this window open while using the website.
"%NODE%" server.js
pause
