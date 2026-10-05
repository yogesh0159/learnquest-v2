@echo off
setlocal
cd /d "%~dp0"
title LearnQuest Jungle Run - Local Server
if "%JUNGLE_PORT%"=="" set JUNGLE_PORT=5177

echo.
echo ==============================================
echo   LearnQuest Jungle Run 3D - local build
echo   Target: Node.js 24
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js 24 LTS from https://nodejs.org , reopen this window, and retry.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if %NODE_MAJOR% LSS 24 (
  echo ERROR: This build targets Node.js 24 or newer. Current version:
  node -v
  echo Please install Node.js 24 LTS and retry.
  pause
  exit /b 1
)
if %NODE_MAJOR% GTR 24 echo NOTE: Node %NODE_MAJOR% detected. This build is tested on Node 24 but newer versions should work.

echo Node:
node -v
echo.

if not exist "node_modules\three\build\three.module.js" (
  echo First-time setup: installing only Three.js for the Jungle game...
  echo Backend and database packages are intentionally skipped.
  echo.
  call npm install --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: Dependency install failed. Retry from this folder with:
    echo   npm install --ignore-scripts --no-audit --no-fund
    pause
    exit /b 1
  )
)

echo Starting local Jungle server on port %JUNGLE_PORT% ...
echo The browser opens automatically once the server answers.
echo Keep this window open while you play. Close it or press Ctrl+C to stop.
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "$u='http://127.0.0.1:%JUNGLE_PORT%'; for($i=0;$i -lt 60;$i++){ try{ Invoke-WebRequest -UseBasicParsing ($u+'/__health') -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process ($u+'/jungle-local-preview.html')"

node scripts/jungle-local-server.js

echo.
echo The Jungle local server has stopped.
pause
endlocal
