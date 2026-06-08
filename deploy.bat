@echo off
chcp 65001 >nul
echo ========================================
echo   Brand Brain 修复包 V2 部署脚本
echo ========================================
echo.

set "SRC=%~dp0src"
set "DST=C:\Users\Administrator\Coze\vi-ai-logo-ip-mock"

echo [1/5] 备份原始文件...
if not exist "%DST%\backup-v2" mkdir "%DST%\backup-v2"
if exist "%DST%\src\lib\billing\cost-estimator.ts" copy /Y "%DST%\src\lib\billing\cost-estimator.ts" "%DST%\backup-v2\cost-estimator.ts.bak" >nul
if exist "%DST%\src\app\api\billing\deepseek-balance\route.ts" copy /Y "%DST%\src\app\api\billing\deepseek-balance\route.ts" "%DST%\backup-v2\deepseek-balance-route.ts.bak" >nul
if exist "%DST%\src\app\api\billing\dashscope-balance\route.ts" copy /Y "%DST%\src\app\api\billing\dashscope-balance\route.ts" "%DST%\backup-v2\dashscope-balance-route.ts.bak" >nul
if exist "%DST%\src\app\api\billing\summary\route.ts" copy /Y "%DST%\src\app\api\billing\summary\route.ts" "%DST%\backup-v2\summary-route.ts.bak" >nul
echo 备份完成

echo.
echo [2/5] 复制修复文件...
xcopy /E /Y "%SRC%\lib\billing\cost-estimator.ts" "%DST%\src\lib\billing\" >nul
xcopy /E /Y "%SRC%\app\api\billing\deepseek-balance\route.ts" "%DST%\src\app\api\billing\deepseek-balance\" >nul
xcopy /E /Y "%SRC%\app\api\billing\dashscope-balance\route.ts" "%DST%\src\app\api\billing\dashscope-balance\" >nul
xcopy /E /Y "%SRC%\app\api\billing\summary\route.ts" "%DST%\src\app\api\billing\summary\" >nul
xcopy /E /Y "%SRC%\lib\industry-materials-map.ts" "%DST%\src\lib\" >nul
echo 文件复制完成

echo.
echo [3/5] 检查环境变量...
findstr /C:"COZE_PAT_TOKEN_EXPIRES" "%DST%\.env.local" >nul 2>&1
if errorlevel 1 (
    echo 添加 COZE_PAT_TOKEN_EXPIRES 到 .env.local ...
    echo COZE_PAT_TOKEN_EXPIRES=2026-07-04 >> "%DST%\.env.local"
    echo 已添加
) else (
    echo COZE_PAT_TOKEN_EXPIRES 已存在
)

findstr /C:"COZE_PAT_TOKEN" "%DST%\.env.local" >nul 2>&1
if errorlevel 1 (
    echo 添加 COZE_PAT_TOKEN 到 .env.local ...
    echo COZE_PAT_TOKEN=pat_UXpA1VIwns8RJ2yoCaEjf715mn2Lmg9s1jywynLb0iGeNPYFPVIqniwtUwrpiC4l >> "%DST%\.env.local"
    echo 已添加
) else (
    echo COZE_PAT_TOKEN 已存在
)

echo.
echo [4/5] 验证文件...
if exist "%DST%\src\lib\billing\cost-estimator.ts" (echo [OK] cost-estimator.ts) else (echo [FAIL] cost-estimator.ts)
if exist "%DST%\src\app\api\billing\deepseek-balance\route.ts" (echo [OK] deepseek-balance/route.ts) else (echo [FAIL] deepseek-balance/route.ts)
if exist "%DST%\src\app\api\billing\dashscope-balance\route.ts" (echo [OK] dashscope-balance/route.ts) else (echo [FAIL] dashscope-balance/route.ts)
if exist "%DST%\src\app\api\billing\summary\route.ts" (echo [OK] summary/route.ts) else (echo [FAIL] summary/route.ts)
if exist "%DST%\src\lib\industry-materials-map.ts" (echo [OK] industry-materials-map.ts) else (echo [FAIL] industry-materials-map.ts)

echo.
echo [5/5] 重启开发服务器...
echo 请手动执行: cd %DST% && npm run dev
echo.
echo ========================================
echo   部署完成！
echo   修复内容:
echo   1. 费用预估: ¥6700 → 真实API成本(~¥0.57)
echo   2. DeepSeek余额: 改用官方API实时查询
echo   3. 通义万相余额: 改用DashScope API查询
echo   4. 扣子Token到期日: 环境变量+页面显示
echo   5. 行业物料映射: 10行业+通用
echo ========================================
pause
