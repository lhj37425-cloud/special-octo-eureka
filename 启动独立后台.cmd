@echo off
cd /d "%~dp0"
start "EVOL DREAM 前台 4173" cmd /k node server.js
start "EVOL DREAM 独立后台 4181" cmd /k node 后台服务器.js
echo 已启动两个本地窗口：前台 http://127.0.0.1:4173/zh/ ，后台 http://127.0.0.1:4181/
