@echo off
chcp 65001 >nul
cd /d D:\disk\HermesDisk\bb-clean

REM Load env vars from .env.local
for /f "tokens=1,* delims==" %%a in (.env.local) do (
    set %%a=%%b
)

echo ============================================
echo   Brand Brain Automation Worker
echo   Polls Supabase for pending tasks
echo   Calls ComfyUI locally for image gen
echo ============================================
echo.
echo Starting worker... (Ctrl+C to stop)
echo.
call npx tsx scripts/worker.mjs
pause
