# Quality Score Integration Plan

## Embedding Quality Assessment into Brand Brain Pipeline

> Version: v1a (Revised: Memory = Audit Log)
> Status: Planning
> Trigger: Yedao Phase 1 -- brandType=unknown, confidence=0.3, Module Plan=85/100
> Prerequisite: V3 (Memory Productionization Complete)
> This revision: Memory = Audit Log. FAIL does not block writes.

---

## 1. Current State

### 1.1 Existing Quality Score Systems

Brand Brain currently has **two independent** quality assessment systems:

#### System A: `manual-quality-score.ts` (Structured Scoring)

| Dimension | Max | Description |
|-----------|-----|-------------|
| brandLogic | 20 | Brand type vs package match |
| visualConsistency | 20 | Visual style coherence |
| assetProtection | 20 | Logo/IP protection (anti-redraw) |
| guidelineCompleteness | 25 | Module completeness |
| productionReadiness | 15 | Production-ready info |
| **Total** | **100** | **Threshold: 75 = PASS** |

**Called after**: Generation completes.
**Integration**: Not in Pipeline. Not written to Supabase.
**History**: One score in JSON memory (Yedao: 83/100).

#### System B: `/api/ai/quality-check` (Pixel-based Image QA)

| Check | Weight | Method |
|-------|--------|--------|
| Brand color consistency | 35% | Sharp 9-point sample vs brand palette |
| Layout balance | 30% | Quadrant brightness variance |
| Contrast | 35% | Light/dark area ratio |
| **Total** | **100%** | **Threshold: 70 = PASS** |

**Called after**: Page rendering.
**Integration**: Exists as API route. Not in Pipeline.

### 1.2 Quality Score Gap in Pipeline

Current pipeline flow:
```
Orchestrator -> Agents execute -> Memory write -> Done
```

Quality Score is NOT in this flow. Even if Brand Analyst outputs confidence=0.3 and brandType=unknown, the Pipeline still:
- Completes successfully
- Writes to Memory
- Returns "success"
- **No WARNING, no BLOCK, no FLAG**

### 1.3 Yedao Validation Findings

| Issue | Severity | Description |
|-------|----------|-------------|
| Brand Analysis quality invisible | HIGH | confidence=0.3 but Pipeline still succeeds |
| Quality Score not stored | MEDIUM | Supabase ProjectMemory has no qualityScore |
| No quality gate | HIGH | Low-quality results cannot be blocked or flagged |
| Module Plan high, Brand Analysis low | MEDIUM | System cannot distinguish good vs bad |

---

## 2. Existing Quality Score Logic

### 2.1 `manual-quality-score.ts` Scoring Model

```typescript
function calculateQualityScore(input: QualityInput): ManualQualityScore
```

Required input:
```typescript
interface QualityInput {
  generatedPageIds: string[];
  pageDescriptions: { pageId, description }[];
  brandProfile: BrandProfile;
  packageDef: PackageDefinition;
  hasLogo: boolean;
  hasMascot: boolean;
}
```

**Core limitation**: This scoring model can only be called AFTER generation completes. Not usable at brand analysis stage.

### 2.2 Current Quality Signal at Brand Analysis Stage

Brand Analyst outputs a `confidence` field (0-1):
- Currently based only on dictionary match quality
- Yedao case: confidence=0.3 (dictionary match failed)
- After field mapping fix: expected confidence=0.7+

### 2.3 Relationship Between Two Quality Systems

| | System A (manual) | System B (pixel) |
|---|-------------------|------------------|
| Phase | Post-generation | Post-render |
| Evaluates | Structured data | Pixel data |
| In Pipeline? | No | No |
| In Memory? | No (JSON only) | No |

---

## 3. Score Calculation Ownership

### 3.1 Three-Phase Scoring Model

Quality Score should be calculated at **three independent stages**:

```
Phase A: Brand Analysis Quality
  Owner: Brand Analyst Agent
  When: After brand analysis completes
  Score: 0-100
  Gate: WARN if < 50

Phase B: Module Plan Quality
  Owner: Brand Planner Agent
  When: After planning completes
  Score: 0-100
  Gate: PASS if >= 60

Phase C: Generation Quality
  Owner: Manual Composer / Quality Check API
  When: After generation completes
  Score: 0-100
  Based on: manual-quality-score.ts + pixel check
  Gate: PASS if >= 75
```

### 3.2 Why Not Merge Into One Score

```
Phase A: 30 + Phase C: 85 = Average: 57.5
  -> Hides Phase A failure
  -> Correct: independent reporting, independent gates
```

---

## 4. Integration Points

### 4.1 Integration Method

Do not modify Agents or Orchestrator logic. Inject Quality Score calculation **before Memory write** in orchestrator.ts:

```
Agent execution completes
  -> (New) Calculate Phase Quality Score
  -> (New) Apply Gate (PASS / WARN / FAIL)
  -> Memory write (existing flow) -- ALWAYS writes regardless of gate
  -> (New) Store Quality Score + gate result in ProjectMemory
```

### 4.2 Scope of Changes

| File | Change | Risk |
|------|--------|------|
| orchestrator.ts | Add Quality Score calculation + gate | LOW |
| memory/types.ts | No change (qualitScore exists) | NONE |
| manual-quality-score.ts | No change | NONE |
| supabase-adapter.ts | No change | NONE |

### 4.3 Files NOT Modified

```
src/agents/*            -> Not modified
src/lib/memory/types.ts  -> Not modified
src/lib/memory/index.ts  -> Not modified
src/lib/brand-analyzer.ts -> Not modified
Freeze zones             -> Not modified
```

---

## 5. Pipeline Gate Design

### 5.1 Gate Definitions

```
Phase A (Brand Analysis)
  SCORE >= 70 -> PASS -> Enter Phase B
  SCORE >= 40 -> WARN -> Enter Phase B + flag for review
  SCORE < 40  -> FAIL -> Block Phase B (Memory still written, status=failed)

Phase B (Module Plan)
  SCORE >= 70 -> PASS -> Enter Phase C
  SCORE >= 50 -> WARN -> Enter Phase C + flag
  SCORE < 50  -> FAIL -> Block Phase C (Memory still written, status=failed)

Phase C (Generation)
  SCORE >= 75 -> PASS -> Mark as READY
  SCORE >= 50 -> WARN -> Mark for review
  SCORE < 50  -> FAIL -> Mark for regeneration
                         (Memory still written, status=failed)
```

### 5.2 Brand Analyst Failure (Yedao Case)

Yedao Phase 1 output: confidence=0.3, brandType=unknown, brandPersona=[]

**With Quality Gate ON:**

```
Brand Analyst outputs confidence=0.3
  -> Phase A Score = 30
  -> Gate = FAIL
  -> Pipeline terminates, BUT writes to Memory:
     {
       status: "failed",
       failureReason: "brand_analysis_low_confidence",
       phaseA: { score: 30, gate: "FAIL" },
       phaseB: null,
       phaseC: null,
       qualityFlags: ["brand_analysis_failed"]
     }
  -> User sees error:
     "Brand analysis confidence too low (30/100).
      Please check input data or contact support."
```

**Current behavior (without gate):** Pipeline succeeds silently. No quality flags.

### 5.3 Gate Implementation (Reference)

```typescript
function calculatePhaseAScore(context: AgentContext): ScoreResult {
  const bp = context.brandProfile;
  if (!bp) return { score: 0, gate: "FAIL", flags: ["no_brand_profile"] };

  let score = 0;
  score += bp.confidence * 40;                     // 0-40
  score += (bp.brandType !== "unknown") ? 15 : 0;  // 0-15
  score += Math.min(bp.brandPersona?.length || 0, 6) * 2.5; // 0-15
  score += (bp.brandStage !== "unknown") ? 10 : 0; // 0-10
  score += Math.min(bp.differentiators?.length || 0, 5) * 2; // 0-10
  score += (bp.visualDirection !== "minimal_modern") ? 10 : 0; // 0-10

  score = Math.min(100, Math.round(score));
  let gate = "PASS";
  const flags: string[] = [];
  if (score < 40) { gate = "FAIL"; flags.push("brand_analysis_failed"); }
  else if (score < 70) { gate = "WARN"; flags.push("low_confidence"); }

  return { score, gate, flags };
}
```

---

## 6. Thresholds

### 6.1 Unified Thresholds

| Level | Score Range | Memory Behavior | User Visible |
|-------|------------|-----------------|-------------|
| PASS | >= 75 | Written (status=completed) | Yes |
| WARN | 50-74 | Written (status=warning) | Yes |
| FAIL | < 50 | Written (status=failed) | Yes |

### 6.2 Phase A (Brand Analysis)

| Score | Meaning | Action |
|-------|---------|--------|
| >= 70 | Acceptable | Continue |
| 50-69 | Partially usable | Continue + WARN |
| < 50 | Unusable | Block Phase B (written as failed) |

### 6.3 Phase B (Module Plan)

| Score | Meaning | Action |
|-------|---------|--------|
| >= 75 | Acceptable | Continue |
| 50-74 | Mostly usable | Continue + WARN |
| < 50 | Unusable | Block Phase C (written as failed) |

### 6.4 Phase C (Generation) -- Existing thresholds

| Score | Meaning |
|-------|---------|
| >= 75 | PASS |
| < 75 | needs_revision |
| assetProtection < 15 | critical_asset_risk |
| guidelineCompleteness < 15 | fake_guideline_risk |

---

## 7. Memory Storage Strategy

### 7.1 Storage Location

ProjectMemory already has the field -- no schema change needed:

```typescript
qualityScore?: {
  total: number;
  dimensions: Record<string, number>;
  issues: { severity: string; category: string; message: string; affectedPages?: string[] }[];
  flags: string[];
  checkedAt: string;
};
```

### 7.2 Storage Timing (Revised)

Each phase completes:
  -> Calculate Phase Score
  -> Gate: PASS / WARN / FAIL
  -> **Write to Memory (regardless of gate result)**
  -> Gate == PASS or WARN -> Continue
  -> Gate == FAIL -> Terminate (Memory already written)

Storage format:

```json
{
  "phaseA": { "score": 30, "gate": "FAIL", "status": "failed" },
  "phaseB": null,
  "phaseC": null,
  "failureReason": "brand_analysis_low_confidence",
  "qualityFlags": ["brand_analysis_failed"],
  "checkedAt": "2026-05-31T08:05:42.647Z"
}
```

PASS writes. WARN writes. **FAIL also writes.**

### 7.3 JSON Adapter Compatibility

No change needed. JSON adapter's saveProject() also saves qualityScore.

### 7.4 Audit Log Principle

```
Memory = Audit Log
Not just recording success stories.
```

| Gate Result | status | Memory Write | Next Phase |
|-------------|--------|-------------|------------|
| PASS | completed | Yes | Continue |
| WARN | warning | Yes | Continue (flagged) |
| FAIL | failed | Yes | Blocked |

This enables future analytics:
```
100 projects:
  70 PASS, 20 WARN, 10 FAIL

Of the 10 FAIL:
  5 Brand Analysis failures
  3 Module Plan failures
  2 Generation failures

  4 in food_beverage industry
  3 in technology industry
```

Failed cases are more valuable than successes.

---

## 8. Relationship with Manual Review

### 8.1 Auto vs Manual

| Scenario | Auto (AI) | Manual |
|----------|-----------|--------|
| Brand Analysis | Phase A Score | Positioning accuracy review |
| Module Plan | Phase B Score | Completeness check |
| Generation | Pixel check + structured | Design quality review |
| Final delivery | Combined report | Checklist confirmation |

### 8.2 Manual Override

```typescript
interface QualityOverride {
  type: "manual_review";
  originalScore: number;
  adjustedScore: number;
  reason: string;
  reviewerId: string;
  reviewedAt: string;
}
```

Override scenarios:

| Scenario | Auto | Adjusted | Reason |
|----------|------|----------|--------|
| System misjudgment | 45 (FAIL) | 75 (PASS) | "Input is concise but complete." |
| Expert judgment | 80 (PASS) | 60 (WARN) | "Brand positioning off." |
| Special bypass | 35 (FAIL) | 70 (PASS) | "Unique brand, AI cannot understand." |

After override:
- Original + adjusted score + reason stored in Memory
- Cannot be deleted or overwritten

### 8.3 Yedao Manual Review

```
Auto: 30/100 (FAIL)
  -> Manual review:
     1. Input complete. Failure = field mapping, not brand.
     2. Override to 70/100.
     3. Note: "Field mapping failed. Re-validate after fix."
  -> Pipeline continues.
```

---

## 9. Rollout Plan

### 9.1 Phase 1: Logging Only

| Action | Description |
|--------|-------------|
| Calculate Quality Score | In orchestrator after each phase |
| Write to Memory | Store in ProjectMemory.qualityScore |
| **Gate OFF** | Do not block, only record |
| Dashboard | Viewable in dev |

**Goal**: Baseline. No behavior change.

### 9.2 Phase 2: WARN Only

| Action | Description |
|--------|-------------|
| Gate = WARN | Flag Score < 50 (no block) |
| Pipeline continues | WARN does not stop |
| Frontend hint | User sees WARNING |

**Goal**: Real data collection.

### 9.3 Phase 3: Full Gate

| Action | Description |
|--------|-------------|
| Gate = FAIL | Block next phase when Score < 50 |
| Memory still writes | status=failed, failureReason set |
| Error returned | Clear failure reason + suggestion |
| Override available | Human can bypass |

**Goal**: Gate operational. Failure data stored.

---

## 10. Risks & Guardrails

### 10.1 Risk Register

| Risk | Level | Impact | Mitigation |
|------|-------|--------|------------|
| Threshold too strict | HIGH | Users blocked | Phase 1 record, Phase 2 WARN, Phase 3 overrideable |
| Threshold too loose | MEDIUM | No quality guarantee | Validate against real data |
| Score calculation delay | LOW | UX impact | Sync, < 50ms |
| Override abuse | MEDIUM | Gate useless | All overrides must have reason + reviewer |
| Brand Analyst fix changes scores | LOW | Need re-threshold | Phase 1: collect data first |

### 10.2 Quality Guardrails

```
1. Quality Score must be 0-100
2. Phase A FAIL: block Phase B/C, but Memory writes status=failed
3. Manual Override must have written reason
4. Original score cannot be deleted after override
5. Quality Score always written to Memory (PASS/WARN/FAIL)
6. Threshold adjustments based on >= 10 real project data points
```

### 10.3 Brand Analyst Failure Handling

When Phase A Score < 50:
1. Return structured error report
2. Report includes: missing fields, root cause, suggested actions
3. **Failure record stored in Memory for analysis**
4. User can retry (failure data already preserved)

---

## Appendix A: Implementation Estimate

| Phase | File | Lines | Effort |
|-------|------|-------|--------|
| Phase 1: Logging | orchestrator.ts | ~60 | 1-2h |
| Phase 2: WARN | orchestrator.ts | ~20 | 0.5h |
| Phase 3: Full Gate | orchestrator.ts | ~30 | 0.5h |

**Total: ~110 lines, 1 file (orchestrator.ts)**

### NOT Modified

```
src/agents/*, src/lib/brand-analyzer.ts, src/lib/manual-quality-score.ts
src/lib/memory/*, freeze zones
```

---

## Appendix B: Relationship with V4 Production Validation

| V4 Exit Criterion | Quality Score Role |
|-------------------|-------------------|
| Pipeline 100% success | Not measured by QS |
| Memory write 100% success | QS writes regardless of PASS/WARN/FAIL |
| BrainResult completeness | QS checks completeness |
| Quality Score >= 70 | Phase 3: QS IS the pass criterion |
| Manual Review >= 80% | QS + Manual Review complement |
| Deliverable >= 80% | QS assists delivery check |

---

*Version: v1a (Revised: Memory = Audit Log)*
*Date: 2026-05-31*
*Status: Awaiting Review*
