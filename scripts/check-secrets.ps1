# 一键自查：仓库是否还有明文 API Key 残留 + .env.local 是否齐全。
#
# 用法：powershell -ExecutionPolicy Bypass -File scripts/check-secrets.ps1
# 退出码：0 = 干净（无明文残留、.env.local 齐全）；1 = 发现问题。
# 安全：只输出文件名:行号，绝不输出行内容，绝不输出任何 Key 值。

chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$patterns = @(
  'sk-[A-Za-z0-9]{20,}',
  'eyJ[a-zA-Z0-9_-]{40,}',
  'AKIA[0-9A-Z]{16}',
  'sb_secret_[A-Za-z0-9_-]{10,}',
  'Bearer [A-Za-z0-9._-]{30,}'
)

# 归档区是历史存档：靠“轮换 Key”使其失效，不逐文件清理，因此跳过。
$excludedNames = @('node_modules', '.git', 'logs', '_bridge', '_archive', 'dist', 'build', '.next')
$textExtensions = @('.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.md', '.json', '.css', '.html', '.yml', '.yaml', '.txt', '.mts')
$issueCount = 0

Write-Host "== 1/2 扫描仓库明文 Key（排除归档区）=="
$files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $skip = $false
  foreach ($ex in $excludedNames) {
    if ($_.FullName -match [regex]::Escape("\$ex\")) { $skip = $true; break }
  }
  (-not $skip) -and
  ($_.Name -ne '.env.local') -and
  ($_.Name -ne '.env.example') -and
  ($textExtensions -contains $_.Extension.ToLowerInvariant())
}
foreach ($file in $files) {
  $rel = $file.FullName.Substring($root.Length + 1)
  $lineNo = 0
  try {
    foreach ($line in [System.IO.File]::ReadLines($file.FullName)) {
      $lineNo++
      foreach ($p in $patterns) {
        if ($line -match $p) {
          Write-Host "  发现疑似明文: $rel`:$lineNo（请勿直接查看该行内容）"
          $issueCount++
          break
        }
      }
    }
  } catch {
    # 个别文件编码无法读取时跳过，不影响整体检查
  }
}
if ($issueCount -eq 0) { Write-Host "  无明文残留 ✔" }

Write-Host ""
Write-Host "== 2/2 检查 .env.local 必备钥匙 =="
$envPath = Join-Path $root '.env.local'
$required = @(
  'DEEPSEEK_API_KEY',
  'ARK_API_KEY',
  'GEMINI_API_KEY',
  'TOKENHUB_API_KEY',
  'LIBLIBAI_ACCESS_KEY',
  'LIBLIBAI_SECRET_KEY',
  'ALIYUN_API_KEY',
  'ALIBABA_CLOUD_ACCESS_KEY_ID',
  'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
  'SUPABASE_SERVICE_KEY'
)
$present = @{}
if (Test-Path -LiteralPath $envPath) {
  foreach ($line in [System.IO.File]::ReadLines($envPath)) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      if (-not $present.ContainsKey($matches[1])) { $present[$matches[1]] = $true }
    }
  }
}
foreach ($k in $required) {
  if ($present.ContainsKey($k)) {
    Write-Host "  $k 存在 ✔"
  } else {
    Write-Host "  $k 缺失 ✘"
    $issueCount++
  }
}

Write-Host ""
if ($issueCount -eq 0) {
  Write-Host "结果：干净，无需处理。"
  exit 0
} else {
  Write-Host "结果：发现 $issueCount 处问题，请交回大脑处理。"
  exit 1
}
