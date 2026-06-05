@echo off
echo ========================================
echo   Fix Pack V3.1 - Deploy + Cache Clear
echo ========================================
echo.

cd /d C:\Users\Administrator\Coze\vi-ai-logo-ip-mock

echo [1/3] Overwrite files forcefully...
echo y | copy /Y src\components\client\HeroSection.tsx src\components\client\HeroSection.tsx
echo y | copy /Y src\components\shared\ClientLayout.tsx src\components\shared\ClientLayout.tsx
echo     Source and dest are same = files already in place.

echo.
echo [2/3] Clear Next.js cache...
if exist ".next" (
    rmdir /S /Q .next
    echo     .next cache cleared
) else (
    echo     No .next cache found
)

echo.
echo [3/3] Done! Now run: npm run dev
echo.
echo What this fixes:
echo   - HeroSection: new copy "lao dian, ye zhi de bei ren zhen kan jian"
echo   - ClientLayout: "brand interview" links to /consultation (not /interview)
echo.
pause
