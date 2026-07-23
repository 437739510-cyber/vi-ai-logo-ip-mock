# BrandBrain Project Rules
> Extracted from global AGENTS.md on 2026-07-21 to reduce context pollution.
> Loaded only when working on the bb-clean project.

---

# Zeabur Pre-Deploy Check
## Core Rule
Before any git push to master, run the pre-deploy check script locally.
All FAIL items must be zero before pushing.

## Trigger
- About to git push to BrandBrain repo
- User says "push", "deploy", "push to Zeabur"
- User says "commit and push"

## Steps
1. cd D:\disk\HermesDisk\bb-clean
2. powershell -ExecutionPolicy Bypass -File scripts/pre-deploy-check.ps1
3. FAIL = 0 -> can push. Any FAIL -> fix first.

## 8 Checks
1. Node.js >= 18.x
2. Dependencies (node_modules, package-lock.json)
3. TypeScript (tsc --noEmit)
4. Build config (tsconfig, next.config, build command)
5. Historical issues (hardcoded model/bucket names, debug routes)
6. Environment variables
7. Local build (npm run build)
8. Git commit status

---

# Test & Visual Regression
## Triggers
- Codex modified any src/ .ts/.tsx/.css file
- User says "push", "deploy", "screenshot", "verify"
- Hermes sends a fix .task, Codex finishes

## Flow
1. Run UI snapshots: npm run test:ui-snapshot
2. Write handoff message to MESSAGE/codex-to-hermes-snapshot-YYYYMMDD-HHMM.md
3. Run pre-deploy-check before pushing

## When Hermes responds
- .task file -> claim -> fix -> re-snapshot -> write .done
- Approved -> can push
- Diff report -> fix if needed, then re-snapshot

---

# Full Flow Test (API + E2E)
## Two tests, both required
Before pushing: run API test first, then E2E test.

## API Full-Flow (fast, 3-5 min)
cd D:\disk\HermesDisk\bb-clean
npm run test:api-full-flow

## E2E Full-Flow (slow, 5-15 min)
cd D:\disk\HermesDisk\bb-clean
npm run test:e2e

## After running
1. Write API test result to MESSAGE
2. Write E2E screenshot paths to same message
3. Both PASS -> can push. Either FAIL -> fix and retest.

---

# Vision Review & VQA
## Available Vision Solutions
### Gemini 2.0 Flash (free, needs proxy)
- Script: scripts/playwright/vision-review.py
- Must confirm Kevin has proxy running (127.0.0.1:22307)

### ARK Doubao Vision (paid, China direct)
- Script: scripts/playwright/vision-review.py
- Key status: INVALID since 2026-07-09, waiting for Kevin to update

## Auto Review Flow
After UI snapshots, try:
1. Gemini first
2. ARK if Gemini unavailable
3. Handoff to Hermes if both unavailable

## VQA Scoring
- API: ark.cn-beijing.volces.com/api/v3/chat/completions
- Model: doubao-1-5-vision-pro-32k-250115
- 7 dimensions: clarity/lighting/noise/color/aesthetics/text_quality/realism
- Force independent scoring per dimension, use full 0-100 range

---

# Image Generation Engines (Reference)
| Engine | Cost | Use | Status |
|--------|------|-----|--------|
| ARK Seedream 4.0 | ¥0.20 | Logo | OK |
| ARK Seedream 4.5 | ¥0.25 | Logo refine | OK |
| ARK Seedream 5.0 | ¥0.22 | Logo/scene | OK |
| ComfyUI local | Free | Logo/scene | OK :8188 |
| LiblibAI | Metered | Logo | OK |
| Tongyi Qianwen | - | Image | OVERDUE |
| HY-Image (Tencent) | 1 credit | Image | Chinese unreliable |

## LiblibAI Templates
Star-3 Alpha: 5d7e67009b344550bc1aa6ccbfa1d7f4
Realistic XL: 7d0cdfd2e23047a19f1e064d04031fc3

## Tencent TokenHub
- hy-image-lite / hy-image-v3.0: 1 credit each
- Chinese unreliable for brand VI
- Use only for non-Chinese generic scene images
