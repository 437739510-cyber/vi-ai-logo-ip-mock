<#
Brand Brain Zeabur Deployment Pre-flight Check (PowerShell)
Purpose: Run all local checks before pushing to Zeabur, catch 90%+ build failures early
System:  Windows 10/11, PowerShell 5.1+
Usage:   .\scripts\pre-deploy-check.ps1
#>

$Red    = [ConsoleColor]::Red
$Green  = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$White  = [ConsoleColor]::White
$Cyan   = [ConsoleColor]::Cyan

$script:PassCount = 0
$script:FailCount = 0
$script:WarnCount = 0

function Write-Pass {
    param([string]$Message)
    Write-Host "[PASS] " -ForegroundColor $Green -NoNewline
    Write-Host $Message -ForegroundColor $White
    $script:PassCount++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] " -ForegroundColor $Red -NoNewline
    Write-Host $Message -ForegroundColor $White
    $script:FailCount++
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] " -ForegroundColor $Yellow -NoNewline
    Write-Host $Message -ForegroundColor $White
    $script:WarnCount++
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor $Cyan
Write-Host "  Brand Brain Deployment Pre-flight Check" -ForegroundColor $Cyan
Write-Host "  Running all 8 checks..." -ForegroundColor $Cyan
Write-Host "==============================================" -ForegroundColor $Cyan
Write-Host ""

# ==============================================
# Check 01: Runtime version alignment
# ==============================================
Write-Host "[01/08] Runtime version check"

try {
    $nodeVersion = node -v
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -ge 18) {
        Write-Pass "Node.js $nodeVersion meets requirement (>= 18.x)"
    } else {
        Write-Fail "Node.js too old ($nodeVersion). Zeabur needs >= 18.x. Please upgrade."
    }
    $npmVersion = npm -v
    Write-Pass "npm $npmVersion OK"
} catch {
    Write-Fail "Node.js not detected. Please install Node.js >= 18 first."
}
Write-Host ""

# ==============================================
# Check 02: Dependency integrity
# ==============================================
Write-Host "[02/08] Dependency integrity"

if (Test-Path "node_modules") {
    Write-Pass "node_modules exists"
} else {
    Write-Fail "node_modules missing. Run: npm install"
}

if (Test-Path "package-lock.json") {
    Write-Pass "package-lock.json exists"
} else {
    Write-Warn "package-lock.json missing. Generate before deploy to avoid version drift."
}

try {
    node -e "require('next')" | Out-Null
    Write-Pass "Next.js core dependency OK"
} catch {
    Write-Fail "Next.js dependency missing. Run: npm install"
}
Write-Host ""

# ==============================================
# Check 03: TypeScript full type check
# ==============================================
Write-Host "[03/08] TypeScript type check"

try {
    npx tsc --noEmit --skipLibCheck | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "TypeScript: zero type errors"
    } else {
        Write-Fail "TypeScript errors found. Fix before deploying."
    }
} catch {
    Write-Fail "tsc check failed to run. Is TypeScript installed?"
}
Write-Host ""

# ==============================================
# Check 04: Build config compliance
# ==============================================
Write-Host "[04/08] Build config compliance"

# 4.1 tsconfig _archive exclusion
if (Test-Path "tsconfig.json") {
    $tsconfigContent = Get-Content "tsconfig.json" -Raw
    if ($tsconfigContent -match "_archive") {
        Write-Pass "tsconfig.json excludes _archive directory"
    } else {
        Write-Fail "tsconfig.json does NOT exclude _archive. Build will scan old scripts and fail."
    }
} else {
    Write-Warn "tsconfig.json not found. Skipping config check."
}

# 4.2 next.config check (project uses .ts, also cover .js/.mjs)
if ((Test-Path "next.config.ts") -or (Test-Path "next.config.js") -or (Test-Path "next.config.mjs")) {
    Write-Pass "Next.js config file exists"
} else {
    Write-Warn "No next.config file found. Confirm Zeabur build config is aligned."
}

# 4.3 build command check
if (Test-Path "package.json") {
    $pkgContent = Get-Content "package.json" -Raw
    if ($pkgContent -match '"build":\s*"next build"') {
        Write-Pass "package.json build command correct (next build)"
    } else {
        Write-Warn "Build command is not standard 'next build'. Confirm Zeabur alignment."
    }
}
Write-Host ""

# ==============================================
# Check 05: Historical issue residue
# ==============================================
Write-Host "[05/08] Historical residue check"

# 5.1 Unofficial model name hardcodes
$modelMatches = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" `
    | Select-String -Pattern "deepseek-v4-flash" `
    | Measure-Object | Select-Object -ExpandProperty Count
if ($modelMatches -eq 0) {
    Write-Pass "No hardcoded 'deepseek-v4-flash' found"
} else {
    Write-Warn "Found $modelMatches file(s) with 'deepseek-v4-flash' hardcode. Consider using constants."
}

# 5.2 Bucket name hardcodes (exclude storage.ts which is the canonical definition)
$bucketMatches = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" `
    | Where-Object { $_.Name -ne "storage.ts" } `
    | Select-String -Pattern '"brand-brain-generated"' `
    | Measure-Object | Select-Object -ExpandProperty Count
if ($bucketMatches -eq 0) {
    Write-Pass "No hardcoded bucket names found"
} else {
    Write-Warn "Found $bucketMatches file(s) with hardcoded bucket name. Consider using constants."
}

# 5.3 Debug routes in production
if (Test-Path "src/app/api/admin/debug-env") {
    Write-Fail "Production code still has debug-env route. Security risk!"
} else {
    Write-Pass "No debug routes left in production code"
}
Write-Host ""

# ==============================================
# Check 06: Environment variable completeness
# ==============================================
Write-Host "[06/08] Environment variable check"

if (Test-Path ".env.example") {
    $requiredVars = Get-Content ".env.example" `
        | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } `
        | ForEach-Object { ($_ -split '=')[0].Trim() } `
        | Where-Object { $_ -ne '' }

    # Project uses .env.local; fall back to .env
    $envFile = if (Test-Path ".env.local") { ".env.local" } elseif (Test-Path ".env") { ".env" } else { $null }

    if ($envFile) {
        $envContent = Get-Content $envFile -Raw
        $missingCount = 0
        foreach ($var in $requiredVars) {
            if ($envContent -notmatch "(?m)^$var\s*=") {
                Write-Warn "Env variable '$var' missing in $envFile. Confirm Zeabur backend has it configured."
                $missingCount++
            }
        }
        if ($missingCount -eq 0) {
            Write-Pass "All required env variables present in $envFile"
        }
    } else {
        Write-Warn "No .env.local or .env found. Skipping variable check."
    }
} else {
    Write-Warn "No .env.example reference file. Skipping variable check."
}
Write-Host ""

# ==============================================
# Check 07: Local build simulation (CORE)
# ==============================================
Write-Host "[07/08] Local build simulation (core check)"
Write-Host "  Running npm run build, estimated 20-60s..."
$buildStart = Get-Date
npm run build 2>&1 | Out-Host
if ($LASTEXITCODE -eq 0) {
    $buildDuration = [math]::Round(((Get-Date) - $buildStart).TotalSeconds, 1)
    Write-Pass "Local build succeeded in ${buildDuration}s. Online build likely to pass."
} else {
    Write-Fail "Local build FAILED. Fix errors before deploying to Zeabur."
}
Write-Host ""

# ==============================================
# Check 08: Git commit status
# ==============================================
Write-Host "[08/08] Git commit status"

try {
    $uncommitted = (git status --porcelain 2>$null | Measure-Object).Count
    if ($uncommitted -eq 0) {
        Write-Pass "All code committed. Push matches local."
    } else {
        Write-Warn "$uncommitted uncommitted change(s). Sure everything should go?"
    }
    $branch = git branch --show-current 2>$null
    Write-Pass "Current branch: $branch"
} catch {
    Write-Warn "Git not available. Skipping commit status check."
}
Write-Host ""

# ==============================================
# Final report
# ==============================================
Write-Host "==============================================" -ForegroundColor $Cyan
Write-Host "  Pre-flight Complete - Final Report" -ForegroundColor $Cyan
Write-Host "==============================================" -ForegroundColor $Cyan
Write-Host "  Pass : " -NoNewline
Write-Host "$PassCount items" -ForegroundColor $Green
Write-Host "  Warn : " -NoNewline
Write-Host "$WarnCount items" -ForegroundColor $Yellow
Write-Host "  Fail : " -NoNewline
Write-Host "$FailCount items" -ForegroundColor $Red
Write-Host ""

if ($FailCount -gt 0) {
    Write-Host "  FATAL: $FailCount error(s). Pushing to Zeabur is BLOCKED." -ForegroundColor $Red
    Write-Host "  Fix all FAIL items, then re-run this script." -ForegroundColor $Red
    Write-Host ""
    exit 1
} else {
    if ($WarnCount -gt 0) {
        Write-Host "  WARNING: $WarnCount warning(s). Deployment allowed, but recommend addressing." -ForegroundColor $Yellow
        Write-Host "  All fatal errors cleared. Safe to push to Zeabur." -ForegroundColor $Yellow
    } else {
        Write-Host "  ALL CLEAR. Safe to deploy to Zeabur." -ForegroundColor $Green
    }
    Write-Host ""
    exit 0
}
