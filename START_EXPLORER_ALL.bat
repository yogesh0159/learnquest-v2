@echo off
setlocal
cd /d "%~dp0"
title LearnQuest Explorer - FULL local app
if "%EXPLORER_PORT%"=="" set EXPLORER_PORT=4000

echo.
echo ==============================================
echo   LearnQuest EXPLORER - the whole app locally
echo   (login, parent dashboard, rewards, Maths
echo    Kingdom, Jungle Run 3D, test tools)
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
if %NODE_MAJOR% LSS 22 (
  echo ERROR: Node 22.13 or newer is required ^(Node 24 recommended^). Current:
  node -v
  pause
  exit /b 1
)
echo Node:
node -v
echo.

if not exist "node_modules\three\build\three.module.js" (
  echo First-time setup: installing Three.js ...
  call npm install --ignore-scripts --no-audit --no-fund
  if errorlevel 1 ( echo ERROR: npm install failed. & pause & exit /b 1 )
)
if not exist "backend\node_modules\express\package.json" (
  echo First-time setup: installing backend packages ^(pure JavaScript, no compiler needed^) ...
  call npm --prefix backend install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
  if errorlevel 1 ( echo ERROR: backend install failed. & pause & exit /b 1 )
)

echo Starting the full app on port %EXPLORER_PORT% ...
echo The Explorer hub opens automatically. Keep this window open. Ctrl+C stops it.
echo.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "$u='http://127.0.0.1:%EXPLORER_PORT%'; for($i=0;$i -lt 90;$i++){ try{ Invoke-WebRequest -UseBasicParsing ($u+'/api/health') -TimeoutSec 1 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process ($u+'/explorer.html')"

node --disable-warning=ExperimentalWarning scripts/start-explorer.js

echo.
echo The LearnQuest server has stopped.
pause
endlocal
