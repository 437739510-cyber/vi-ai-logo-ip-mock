@echo off
echo ========================================
echo   Brand Brain Fix Pack V2 - Deploy
echo ========================================
echo.

cd /d C:\Users\Administrator\Coze\vi-ai-logo-ip-mock

echo [1/4] Check IP process directory...
if not exist "src\app\api\ip\process" (
    mkdir "src\app\api\ip\process"
    echo     Created src\app\api\ip\process\
) else (
    echo     Directory exists
)

echo.
echo [2/4] Check key files...
if exist "src\lib\industry-materials-map.ts" (
    echo     OK industry-materials-map.ts
) else (
    echo     MISSING src\lib\industry-materials-map.ts
)
if exist "src\lib\ip-asset-pipeline.ts" (
    echo     OK ip-asset-pipeline.ts
) else (
    echo     MISSING src\lib\ip-asset-pipeline.ts
)
if exist "src\lib\billing\cost-estimator.ts" (
    echo     OK cost-estimator.ts
) else (
    echo     MISSING src\lib\billing\cost-estimator.ts
)
if exist "src\app\api\billing\summary\route.ts" (
    echo     OK billing summary route.ts
) else (
    echo     MISSING billing summary route.ts
)

echo.
echo [3/4] Add env vars to .env.local ...
findstr /C:"COZE_PAT_TOKEN_EXPIRES" .env.local >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo COZE_PAT_TOKEN_EXPIRES=2026-07-04 >> .env.local
    echo     Added COZE_PAT_TOKEN_EXPIRES
) else (
    echo     COZE_PAT_TOKEN_EXPIRES already exists, skip
)
findstr /C:"COZE_PAT_TOKEN=pat_" .env.local >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo COZE_PAT_TOKEN=pat_UXpA1VIwns8RJ2yoCaEjf715mn2Lmg9s1jywynLb0iGeNPYFPVIqniwtUwrpiC4l >> .env.local
    echo     Added COZE_PAT_TOKEN
) else (
    echo     COZE_PAT_TOKEN already exists, skip
)

echo.
echo [4/4] Install sharp...
call npm install sharp

echo.
echo ========================================
echo   Done! Now run: npm run dev
echo ========================================
echo.
echo Verify after startup:
echo   1. Cost estimate ~0.57 CNY (not 6700)
echo   2. DeepSeek/DashScope balance shows
echo   3. Token expiry: 2026-07-04
echo   4. IP API: POST /api/ip/process
echo.
pause
