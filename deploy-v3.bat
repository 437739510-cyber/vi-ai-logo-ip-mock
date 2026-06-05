@echo off
echo ========================================
echo   Brand Brain Fix Pack V3 - Deploy
echo ========================================
echo.

cd /d C:\Users\Administrator\Coze\vi-ai-logo-ip-mock

echo [1/4] Copy dashscope-balance fix...
copy /Y src\app\api\billing\dashscope-balance\route.ts src\app\api\billing\dashscope-balance\
echo     Done.

echo [2/4] Copy ClientLayout (add student + interview nav)...
copy /Y src\components\shared\ClientLayout.tsx src\components\shared\
echo     Done.

echo [3/4] Copy AdminLayout (add student management menu)...
copy /Y src\components\shared\AdminLayout.tsx src\components\shared\
echo     Done.

echo [4/4] Copy Students page...
if not exist "src\app\admin\students" mkdir "src\app\admin\students"
copy /Y src\app\admin\students\page.tsx src\app\admin\students\
echo     Done.

echo.
echo ========================================
echo   V3 Deploy complete!
echo   Restart dev server: Ctrl+C then npm run dev
echo ========================================
echo.
echo What changed:
echo   1. DashScope balance: now reads ALIYUN_API_KEY
echo   2. Client nav: Brand Interview + Student Join
echo   3. Admin sidebar: Student Management added
echo   4. Admin /admin/students page created
echo.
pause
