@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo   LearnQuest Full Local Setup - Node 24

echo ==============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if not "%NODE_MAJOR%"=="24" (
  echo ERROR: Node.js 24.x is required by this upgraded build.
  node -v
  pause
  exit /b 1
)

echo Node:
node -v
echo npm:
npm -v
echo.

echo Cleaning any failed/incomplete old native dependency install...
if exist backend\node_modules rmdir /s /q backend\node_modules

echo.
echo Installing root + backend dependencies for Node 24...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed. See the messages above.
  pause
  exit /b 1
)

echo.
echo Running project syntax/structure checks...
call npm run check
if errorlevel 1 (
  echo.
  echo WARNING: Install succeeded but a project check failed.
  pause
  exit /b 1
)

echo.
echo SUCCESS: LearnQuest is installed for Node 24.
echo For Jungle-only preview: START_JUNGLE_LOCAL.bat
echo For backend: npm start
pause
endlocal
