@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次啟動：安裝必要套件...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo 啟動 RPG Server...
echo 若要指定模型，可先設定 OLLAMA_MODEL 環境變數。
start "" http://127.0.0.1:3000
npm start
pause
