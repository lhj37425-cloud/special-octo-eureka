@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js，再运行此文件。
  pause
  exit /b 1
)
echo EVOL DREAM MVP
echo 前台：http://127.0.0.1:4173/zh/
echo 后台：http://127.0.0.1:4173/zh/admin/
echo 请保留此窗口。停止服务请按 Ctrl+C。
node server.js
pause
