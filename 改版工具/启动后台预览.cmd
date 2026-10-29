@echo off
cd /d "%~dp0"
start "EVOL DREAM admin preview 4373+4381" cmd /k node 后台预览.cjs
echo Frontend: http://127.0.0.1:4373/zh/
echo Backend:  http://127.0.0.1:4381/
