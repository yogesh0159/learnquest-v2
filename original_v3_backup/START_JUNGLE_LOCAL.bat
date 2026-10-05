@echo off
setlocal
cd /d "%~dp0"
title LearnQuest Jungle Local Server

echo.
echo ==============================================
echo   LearnQuest Jungle Local Lab - Node 24
echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js 24 LTS, reopen CMD, and retry.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if not "%NODE_MAJOR%"=="24" (
  echo ERROR: This upgraded build requires Node.js 24.x.
  echo Current version:
  node -v
  echo.
  echo Please install Node.js 24 LTS and retry.
  pause
  exit /b 1
)

echo Node:
node -v
echo npm:
call npm -v
echo.

if not exist "node_modules\three\build\three.module.js" (
  echo First-time setup: installing only Three.js for the local Jungle Lab...
  echo Backend/database packages are intentionally skipped.
  echo.
  call npm install --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: Local dependency install failed.
    echo You can retry from this folder with:
    echo   npm install --ignore-scripts --no-audit --no-fund
    pause
    exit /b 1
  )
)

echo.
echo Starting local Jungle server...
echo Browser will open automatically when the server is starting.
echo Keep this window open while testing the Jungle Lab.
echo.

rem Open the browser in a separate process after the local Node server has had time to start.
rem Using the current window for npm avoids Windows nested-quote/path syntax problems.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5177/jungle-local-preview.html'"

call npm run jungle:local

echo.
echo The Jungle local server has stopped.
pause
endlocal
