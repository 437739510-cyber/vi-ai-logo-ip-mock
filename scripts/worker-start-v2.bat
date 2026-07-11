@echo off
chcp 65001 >nul
cd /d D:\disk\HermesDisk\bb-clean

echo ============================================
echo   Brand Brain Automation Worker v2
echo   Engine: Z-Image Turbo GGUF (Chinese 90/100)
echo   Polls Supabase for pending tasks
echo ============================================

REM 1. Check ComfyUI is running
echo Checking ComfyUI...
curl -s http://127.0.0.1:8188 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Starting ComfyUI with --lowvram...
    start "ComfyUI" /MIN python main.py --gpu-only --lowvram --port 8188
    timeout /t 15 /nobreak >nul
    echo ComfyUI started.
) else (
    echo ComfyUI already running.
)

REM 2. Load env vars
for /f "tokens=1,* delims==" %%a in (.env.local) do (
    set %%a=%%b
)

REM 3. Start worker
echo.
echo Starting worker... (Ctrl+C to stop)
echo Heartbeat writes to Supabase every 10s
echo.
call npx tsx scripts/worker.mjs
pause
