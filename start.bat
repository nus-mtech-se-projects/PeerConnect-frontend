@echo off
echo Killing processes on ports 5173 and 5174...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting Vite dev server...
cd /d %~dp0
npx vite
