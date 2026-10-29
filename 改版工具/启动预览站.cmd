@echo off
cd /d "%~dp0"
start "EVOL DREAM preview 4273" cmd /k node preview-server.cjs
echo Preview: http://127.0.0.1:4273/zh/
