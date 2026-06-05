@echo off
echo === V3.6 Fix Pack Deployment ===
echo.

cd /d C:\Users\Administrator\Coze\vi-ai-logo-ip-mock

echo [1/3] Extracting fix pack...
tar -xzf fix-pack-v3.6.tar.gz
echo Done.

echo [2/3] Removing fixed page count from project detail page...
powershell -Command "$f='src\app\admin\projects\[id]\page.tsx'; $c=[System.IO.File]::ReadAllText((Resolve-Path $f).Path,[System.Text.Encoding]::UTF8); $c=$c -replace '11 \u9875\u56FE\u7247','\u9875\u9762\u56FE\u7247'; [System.IO.File]::WriteAllText((Resolve-Path $f).Path,$c,[System.Text.Encoding]::UTF8)"
echo Done.

echo [3/3] Cleaning Next.js cache...
if exist .next rmdir /S /Q .next
echo Done.

echo.
echo === Deployment Complete ===
echo Fixes:
echo   1. dashscope-balance API: added "availableAmount" field
echo   2. Removed fixed page count (11 pages -> no fixed number)
echo.
echo Now run: npm run dev
echo.
pause
