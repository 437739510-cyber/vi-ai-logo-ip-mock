@echo off
echo === Brand Brain V3.4 Combined Fix Pack Deployment ===
echo.

cd /d C:\Users\Administrator\Coze\vi-ai-logo-ip-mock

echo [1/4] Extracting fix pack...
tar -xzf fix-pack-v3.4-combined.tar.gz
echo Done.

echo [2/4] Adding environment variables...
findstr /C:"ALIBABA_CLOUD_ACCESS_KEY_ID" .env.local >nul 2>&1
if %errorlevel% neq 0 (
    echo ALIBABA_CLOUD_ACCESS_KEY_ID=LTAI5t61aashrNngr1fwhDEv>> .env.local
    echo ALIBABA_CLOUD_ACCESS_KEY_SECRET=TTzcPec6slqms3bZms6grl2v8PUz3Z>> .env.local
    echo Added AccessKey env vars.
) else (
    echo AccessKey env vars already exist.
)

echo [3/4] Cleaning Next.js cache...
if exist .next rmdir /S /Q .next
echo Done.

echo [4/4] Ready! Now run: npm run dev
echo.
echo === Deployment Complete ===
echo.
echo What this fix pack includes:
echo   V3.2: /interview page + /student/register page + /api/interview/chat
echo   V3.3: billing/summary format fix
echo   V3.4: BSS QueryAccountBalance for real balance display
echo.
echo New env vars added:
echo   ALIBABA_CLOUD_ACCESS_KEY_ID
echo   ALIBABA_CLOUD_ACCESS_KEY_SECRET
echo.
pause
