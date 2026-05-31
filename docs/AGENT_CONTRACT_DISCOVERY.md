# Agent Contract Discovery

> **Read-only analysis of Brand Brain Agent Architecture**
> Generated: 2026-05-31
> Scope: 6 Agents + 1 Orchestrator
> Mode: TASK-003 — no code modifications, no new agent design

---

## 1. Agent Registry (from ARCHITECTURE_SSOT)

| # | Agent | File | Version |
|---|-------|------|---------|
| 1 | Brand Analyst | `src/agents/brand-analyst.ts` | 1.0.0 |
| 2 | Brand Planner | `src/agents/brand-planner.ts` | 1.0.0 |
| 3 | Mascot Designer | `src/agents/mascot-designer.ts` | 1.0.0 |
| 4 | Design Director | `src/agents/design-director.ts` | 1.0.0 |
| 5 | Asset Guardian | `src/agents/asset-guardian-agent.ts` | 1.0.0 |
| 6 | Manual Composer | `src/agents/manual-composer.ts` | 1.0.0 |
| — | Orchestrator | `src/agents/orchestrator.ts` | 1.0.0 |

---

## 2. Individual Agent Contracts

### Agent 1: Brand Analyst

```
┌─────────────────────────────────────────────┐
│              Brand Analyst                   │
│          src/agents/brand-analyst.ts         │
│     Engine: lib/brand-analyzer.ts            │
│     Dictionary: lib/brand-dictionary.ts      │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Analyze raw client submission data and produce a structured BrandProfile capturing brand type, personality, positioning, voice, and visual direction |
| **Inputs** | `clientInfo.companyName`, `.industry`, `.brandVision`, `.coreValues`, `.targetMarket`, `.logoPhilosophy`, `.mascotPhilosophy`, `.logoAssets[]`, `.mascotAssets[]`, `.brandColors{}`, `.referenceManual{}`, `.businessProfile{}` |
| **Outputs** | `BrandProfile { brandType, confidence, brandPersona[], industry, industryCategory, hasLogo, hasMascot, brandStage, targetAudience, differentiators[], visualDirection, brandPositioning, brandVoice[], brandArchetype, analysis { brandVisionKeywords[], coreValueKeywords[], marketKeywords[] } }` |
| **Engine Dependencies** | `lib/brand-analyzer.ts` — `analyzeBrand(clientInfo)` — rule-based keyword matching returning `BrandProfile`. Uses `lib/brand-dictionary.ts` — `scanMultipleFields()` for multi-field keyword scan. |
| **Memory Access** | None (pure analysis, no persistence I/O) |
| **Asset Access** | Reads `logoAssets[]` and `mascotAssets[]` for existence/quantity only — does not inspect asset content |
| **Preconditions** | `context.clientInfo` must exist with at least `companyName` or `brandVision` populated. Otherwise `canExecute()` returns `false`. |
| **Postconditions** | `context.brandProfile` populated with complete analysis. Orchestrator will write results to ClientMemory + ProjectMemory after pipeline completes. |
| **Failure Modes** | 1. Low confidence (< 0.5) — warns but continues. 2. Missing `logoPhilosophy` when logo exists — warns. 3. Missing `mascotPhilosophy` when mascot exists — warns. 4. `analyzeBrand()` exception — returns AgentResult with `success: false`. |

---

### Agent 2: Brand Planner

```
┌─────────────────────────────────────────────┐
│              Brand Planner                   │
│          src/agents/brand-planner.ts         │
│     Engines: lib/module-planner.ts           │
│              lib/module-to-page.ts           │
│              lib/manual-packages.ts          │
│              lib/industry-knowledge.ts       │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Generate a module plan and page generation plan based on the BrandProfile, including module scores, package recommendation, and estimated page count |
| **Inputs** | `context.brandProfile` (BrandProfile from Agent 1) |
| **Outputs** | `{ modulePlan { modules[], totalEstimatedPages, pageRange[], summary, packageRecommendation }, pagePlan { pageIds[], pageLabels[], totalPages }, resourceEstimate { estimatedApiCalls, estimatedTimeMinutes, estimatedCost }, summary { essentialModules, recommendedModules, totalPages } }` |
| **Engine Dependencies** | `lib/module-planner.ts` — `planModules(profile)` — 15 module definitions with double-factor scoring (brand 60% + business 40%). `lib/module-to-page.ts` — `modulePlanToPages(plan)` — maps module IDs to page IDs via `MODULE_TO_PAGE_MAP`. `lib/manual-packages.ts` — `recommendPackage(profile)`. `lib/industry-knowledge.ts` — `getProfileForBrand(profile)`. |
| **Memory Access** | None |
| **Asset Access** | None directly — reads brandType, brandPersona, industryCategory from BrandProfile |
| **Preconditions** | `context.brandProfile` must exist. Otherwise `canExecute()` returns `false`. |
| **Postconditions** | `context.modulePlan` populated with full module plan, page plan, and resource estimates |
| **Failure Modes** | 1. Low page count (< 8) — warns. 2. High page count (> 30) — warns. 3. `planModules()` or `modulePlanToPages()` exception — returns `success: false`. |

**Scoring Architecture:**
- Each of 15 modules has a `baseScore` (0-100) and `boostConditions` (functions of BrandProfile)
- Each boost condition adds +15 points, capped at 100
- Score → Priority: >= 80 = essential, >= 40 = recommended, < 40 = optional
- Brand-side score determines module selection; Business-side score (40%) determines package recommendation

---

### Agent 3: Mascot Designer

```
┌─────────────────────────────────────────────┐
│            Mascot Designer                   │
│         src/agents/mascot-designer.ts        │
│     Engine: built-in recommendMascot()       │
│     (pure function, no library dependency)   │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Analyze whether a brand needs an IP mascot character across 4 modes: `protect_existing`, `create_new`, `optional_recommend`, `not_needed`. If creation is recommended, also suggest mascot type, personality, visual traits, and module recommendations. |
| **Inputs** | `context.brandProfile` (brandType, industryCategory, brandPersona, brandArchetype, brandStage) + `context.clientInfo` (mascotAssets[], businessProfile.businessGoal, businessProfile.businessStage) |
| **Outputs** | `MascotProfile { mode, confidence, hasMascot, existingMascotName?, existingMascotCount?, suggestedName?, suggestedType?, suggestedRole?, personality[], visualTraits[], colorDirection[], storySummary?, usageScenarios[], reason, recommendedModules[] }` |
| **Engine Dependencies** | None — `recommendMascot()` is a pure function with 100% self-contained logic: industry-mascot map (10 industries), brand type boosts (10 types), business goal boosts (4 goals), brand persona scoring (9 persona mappings), 4 depth levels. |
| **Memory Access** | None |
| **Asset Access** | Reads `mascotAssets[]` for existence check only |
| **Preconditions** | `context.brandProfile` must exist. Otherwise `canExecute()` returns `false`. |
| **Postconditions** | `context.mascotProfile` populated. **Additionally**: Orchestrator performs module plan boost — if mode is `create_new` or `optional_recommend`, recommended modules get +25 score boost and `essential` priority override. |
| **Failure Modes** | 1. `recommendMascot()` exception — returns `success: false`. 2. Low confidence optional_recommend (< 0.5) — warns to confirm with client. |

**Scoring Model (4-factor):**
| Factor | Weight | Sources |
|--------|--------|---------|
| Industry tendency | 35% | `INDUSTRY_MASCOT_MAP` — 10 industries mapped |
| Brand type | 25% | `BRAND_TYPE_MASCOT_BOOST` — 10 brand types |
| Business goal | 20% | `BUSINESS_GOAL_MASCOT_BOOST` — 4 goals |
| Brand persona | 15% | Persona → mascot-friendliness check |
| Special: tech override | +20% | Persona + goal can boost tech brands |

**Thresholds:** >= 0.55 → create_new, >= 0.4 → optional_recommend, < 0.4 → not_needed

---

### Agent 4: Design Director

```
┌─────────────────────────────────────────────┐
│            Design Director                   │
│         src/agents/design-director.ts        │
│     Engine: lib/industry-knowledge.ts        │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Determine visual design direction — color strategy, typography pairing, image style, layout principles, and mood keywords for AI prompt generation |
| **Inputs** | `context.brandProfile` (brandType, brandPersona[], industryCategory, visualDirection, brandPosting?.primary?.hex) + implicitly `context.refId` |
| **Outputs** | `DesignDirection { styleKeywords[], colorStrategy { primary, secondary, accent, rationale }, typography { headingFont, bodyFont, accentFont?, rationale }, imageStyle { photography[], illustration[], iconography[] }, layoutPrinciples[], moodKeywords[], referenceStyle? { used, influenceLevel, aspects[] } }` |
| **Engine Dependencies** | `lib/industry-knowledge.ts` — `getProfileForBrand(profile)` returns `IndustryProfile` with designStyle, colorTendency, typographyStyle, visualKeywords. 6 built-in helper functions (deriveColorStrategy, deriveTypography, deriveImageStyle, buildMoodKeywords, deriveLayoutPrinciples — all pure) |
| **Memory Access** | None |
| **Asset Access** | None |
| **Preconditions** | `context.brandProfile` must exist. Otherwise `canExecute()` returns `false`. |
| **Postconditions** | `context.designDirection` populated with complete visual strategy |
| **Failure Modes** | 1. `deriveColorStrategy()` — uses brand persona to pick from 6 color schemes. Falls back to defaults. 2. `deriveTypography()` — uses brand type + persona to pick from 5 typography schemes. Falls back to Noto Sans SC. 3. Exception — returns `success: false`. |

**Color Strategy Rules:**
| Persona | Primary | Tone |
|---------|---------|------|
| 自然 (Natural) | Deep green #005032 | Natural, organic |
| 创新 (Innovative) | Tech blue #1A56DB | Futuristic, smart |
| 精致 (Refined) | Dark #1C1917 | Premium, luxury |
| 温暖 (Warm) | Amber #B45309 | Friendly, approachable |
| 专业 (Professional) | Navy #1E3A5F | Trustworthy, reliable |
| Client-specified colors | override defaults | |

---

### Agent 5: Asset Guardian

```
┌─────────────────────────────────────────────┐
│            Asset Guardian                    │
│       src/agents/asset-guardian-agent.ts     │
│     Engine: lib/asset-guardian.ts            │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Protect brand assets (Logo, IP mascot) from being modified or regenerated by AI. Enforce per-operation permission policies, scan prompts for prohibited references, generate negative prompts for AI image generation. |
| **Inputs** | `context.clientInfo` (logoAssets[], mascotAssets[], logoPhilosophy, mascotPhilosophy) + `input.backgroundPrompt` / `input.generationPrompt` (optional — passed from caller) |
| **Outputs** | `AssetGuardianOutput { protectedAssets[] (type, id, label, urls[], policy), isGenerationSafe, negativePrompt, svgSafetyMarkers, violations[], safeGenerationGuidelines[] }` |
| **Engine Dependencies** | `lib/asset-guardian.ts` — `extractProtectedAssets(clientInfo)` → extracts Logo + all mascots with default policies. `scanPromptForProtectedAssets(prompt, assets)` → regex scan for asset labels, redraw/recolor/material keywords. `generateAssetProtectionNegativePrompt(assets)` → builds comma-separated negative prompt. `guardGenerationRequest(params)` → combined guard function. `buildProtectedAssetSection(assets)` → SVG comment markers. |
| **Memory Access** | None |
| **Asset Access** | **Deep** — reads logo/mascot URLs for protection reference. Enforces DEFAULT_LOGO_POLICY and DEFAULT_MASCOT_POLICY. This is the only agent that directly inspects asset metadata. |
| **Preconditions** | `context.clientInfo` must exist. Otherwise `canExecute()` returns `false`. |
| **Postconditions** | `context.assetGuardResult` populated with protection decisions. Manual Composer checks `isGenerationSafe` before proceeding. |
| **Failure Modes** | 1. No protected assets found — warns but continues (isGenerationSafe = true). 2. Logo files detected but not extracted — warns. 3. Prompt scan finds prohibited content — violations logged, isGenerationSafe set to false. 4. Exception — returns `success: false`. |

**Default Policies:**
| Operation | Logo | Mascot |
|-----------|------|--------|
| Scale | ✅ | ✅ |
| Move | ✅ | ✅ |
| Crop | ❌ | ✅ |
| Opacity | ✅ | ✅ |
| AI redraw | ❌ | ❌ |
| Color change | ❌ | ❌ |
| Material change | ❌ | ❌ |
| Expression change | N/A | ❌ |
| Character redesign | N/A | ❌ |

**Safety enforcement:**
- Prompt scanning: detects asset labels, `redraw`, `recreate`, `recolor`, `material` keywords
- SVG safety markers: embedded as HTML comments in generated SVGs
- Blocking: Manual Composer refuses to run if `isGenerationSafe` is `false`

---

### Agent 6: Manual Composer

```
┌─────────────────────────────────────────────┐
│            Manual Composer                   │
│         src/agents/manual-composer.ts        │
│     (no engine — calls generation API)       │
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Bridge agent pipeline outputs to the existing `generate-manual-pages-stream` SSE API. Compile the full generation payload (page plan, colors, assets, protection rules, design direction) and initiate generation. |
| **Inputs** | `context.modulePlan.pagePlan`, `context.designDirection`, `context.assetGuardResult`, optional: `input.pageIds[]`, `input.mode` (auto/manual), `input.qualityCheck` |
| **Outputs** | `ManualComposerOutput { totalPages, failedPages, durationMs, generatedUrls[], errors[] }` |
| **Engine Dependencies** | None at agent level. Makes HTTP `fetch()` call to `/api/ai/generate-manual-pages-stream` (SSE). Requires `NEXT_PUBLIC_SITE_URL` env variable (defaults to `localhost:3003`). |
| **Memory Access** | Reads `context` values. Does not write to memory directly — memory write is handled by Orchestrator post-pipeline. |
| **Asset Access** | Reads `protectedAssets[]` from Asset Guardian — embeds into generation payload as protection metadata. Reads `clientInfo.logoAssets[0].url` and `clientInfo.mascotAssets[0].files[0].url` for direct asset URLs. |
| **Preconditions** | `context.modulePlan` must exist (otherwise `canExecute()` returns false). `context.assetGuardResult.isGenerationSafe` must be `true` (otherwise blocked). |
| **Postconditions** | Generation request initiated. Does not wait for completion — generation is SSE-streamed. Orchestrator writes results to Memory after pipeline. |
| **Failure Modes** | 1. Manual mode (dry-run) — returns empty result with warning. 2. Generation API fetch failure — returns `success: false` with error message. 3. Missing pagePlan — returns `success: false`. |

**Generation Payload Structure:**
```
{
  projectId, clientInfo,
  brandColors: { primary, secondary, accent },
  logoUrl, mascotUrl, refId, maxPages, mode,
  protectedAssets: [{ type, urls, policy }],
  designDirection: { colorStrategy, typography, styleKeywords, moodKeywords }
}
```

---

### Orchestrator

```
┌─────────────────────────────────────────────┐
│              Orchestrator                    │
│          src/agents/orchestrator.ts          │
│     Memory: lib/memory/ (types, json-adapter)│
└─────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Purpose** | Coordinate the full agent pipeline: read memory before pipeline, dispatch agents sequentially, manage shared AgentContext, write memory after pipeline completion. Provides event-based progress reporting (SSE-compatible). |
| **Inputs** | `clientInfo`, `projectId`, `options: { mode (analyze-only/plan-only/full/generate-only), onEvent (callback), input (optional agent input) }` |
| **Outputs** | `{ success, context (full AgentContext with all agent outputs), errors[], results (per-agent AgentResult) }` |
| **Engine Dependencies** | All 6 agents via `agentMap{}`. `lib/memory/index.ts` — `getMemoryAdapter()`. Memory subsystem reads/writes `clients.json`, `projects.json`, `industries.json`, `index.json`. |
| **Memory Access** | **Full read/write**: `getMemoryAdapter().findClientByCompany()`, `.getProject()`, `.saveClient()`, `.saveProject()`. Memory read at pipeline start (graceful degradation if fails). Memory write at pipeline end (if analysis succeeded). |
| **Asset Access** | None directly — delegates all asset handling to Asset Guardian |
| **Preconditions** | Valid `clientInfo` object. Project ID must be provided by caller. Mode must be one of 4 supported modes. |
| **Postconditions** | 1. AgentContext fully populated with all successful agent outputs. 2. ClientMemory + ProjectMemory written to `public/memory/` JSON files. 3. Module plan boosted if Mascot Designer recommended IP creation. |
| **Failure Modes** | 1. Memory read failure — warns but continues (degraded mode). 2. Agent `canExecute()` returns false — skips agent, logs error, breaks pipeline. 3. Agent execution throws — logs error, breaks pipeline. 4. Memory write failure — warns but pipeline result still returned. 5. Callback emission error — silently caught. |

**Mode → Agent Sequence:**
| Mode | Agents | Pipeline |
|------|--------|----------|
| `analyze-only` | 1 | Brand Analyst |
| `plan-only` | 1, 2 | Brand Analyst → Brand Planner |
| `full` | 1-6 | All agents in default sequence |
| `generate-only` | 5, 6 | Asset Guardian → Manual Composer |

**Memory Write Strategy:**
- Always writes `ClientMemory` (create or update)
- Always writes `ProjectMemory` (append BrainResultSnapshot to history)
- Updates `MemoryIndex`
- Only writes if `brandProfile` exists (analysis succeeded)

**Post-Processing (Module Boost):**
After Mascot Designer completes in `full` mode, the orchestrator boosts recommended module scores by +25 if mascot mode is `create_new` or `optional_recommend`. This is a coupling point between Agent 3 and outputs of Agent 2.

---

## 3. Agent Dependency Graph

```
                    ┌───────────────────┐
                    │   Client Input    │
                    │  (raw materials)  │
                    └────────┬──────────┘
                             │
                             ▼
                    ┌───────────────────┐
               ┌───│ 1. Brand Analyst  │◄──── lib/brand-analyzer.ts
               │   └────────┬──────────┘     lib/brand-dictionary.ts
               │            │ BrandProfile
               │            ▼
               │   ┌───────────────────┐
               │   │ 2. Brand Planner  │◄──── lib/module-planner.ts
               │   └────────┬──────────┘     lib/module-to-page.ts
               │            │                lib/manual-packages.ts
               │            │ ModulePlan     lib/industry-knowledge.ts
               │            ▼
               │   ┌───────────────────┐
               │   │3. Mascot Designer │◄──── (pure — no lib dependency)
               │   └────────┬──────────┘
               │            │ MascotProfile
               │            │   │
               │            │   └──● Orchestrator applies module boost
               │            ▼
               │   ┌───────────────────┐
               │   │4. Design Director │◄──── lib/industry-knowledge.ts
               │   └────────┬──────────┘
               │            │ DesignDirection
               │            ▼
               │   ┌───────────────────┐
               │   │5. Asset Guardian  │◄──── lib/asset-guardian.ts
               │   └────────┬──────────┘
               │            │ AssetGuardResult
               │            │ (isGenerationSafe ▼ gate)
               │            ▼
               │   ┌───────────────────┐
               │   │6. Manual Composer │────► generation API (HTTP)
               │   └────────┬──────────┘
               │            │ GenerationResult
               │            ▼
               │   ┌───────────────────┐
               └──►│   Orchestrator    │◄════ lib/memory/ (read/write)
                    └───────────────────┘
                         │
                         ▼
                    Memory System
                 (clients.json,
                  projects.json,
                  industries.json)
```

### Data Dependency Matrix

| → From / ↓ To | Analyst | Planner | Mascot | Director | Guardian | Composer |
|---------------|---------|---------|--------|----------|----------|----------|
| **Analyst** | — | BP_out | BP_out | BP_out | — | — |
| **Planner** | BP_in | — | BP_out | — | — | — |
| **Mascot** | BP_in | — | — | — | — | — |
| **Director** | BP_in | — | — | — | — | — |
| **Guardian** | — | — | — | — | — | AG_out |
| **Composer** | — | MP_in | — | DD_in | AG_in | — |

*Legend: BP = BrandProfile, MP = ModulePlan, DD = DesignDirection, AG = AssetGuardResult*

---

## 4. Coupling Analysis

### Strong Coupling (blocking dependencies)

| Pair | Type | Dependency | Risk |
|------|------|------------|------|
| Analyst → Planner | Sequential data | Planner requires BrandProfile | If Analyst fails, Planner cannot run. Pipeline stalls. |
| Guardian → Composer | Sequential gate | Composer requires `isGenerationSafe = true` | If Guardian blocks generation, Composer refuses to run. Intentionally strict — security by design. |
| Orchestrator → Memory | Runtime (start + end) | Memory read at start, write at end | Memory write failures are swallowed (warn-only). Memory read failures degrade gracefully. |

### Weak Coupling (non-blocking or optional)

| Pair | Type | Dependency | Risk |
|------|------|------------|------|
| Planner → Mascot Designer | Post-processing | Module boost applied after Mascot completes | Non-blocking. Mascot runs regardless of Planner output. Boost is additive. |
| Mascot Designer ↔ Design Director | None | No data shared between these agents | Fully parallelizable — both read from BrandProfile but write to different context fields. |
| Planner → Director | None (shared input) | Both read BrandProfile | Parallelizable — no ordering dependency. |

### Implicit Dependencies

| Dependency | Source | Description | Risk |
|------------|--------|-------------|------|
| **Context pollution** | All agents via `AgentContext` | All agents share the same mutable context object. Any agent can read or write any field. No access control. | Medium — an agent could inadvertently override another agent's output. Current code is disciplined, but no enforcement. |
| **Hardcoded agent map** | Orchestrator | Agent registry is hardcoded in `orchestrator.ts` via `agentMap`. Adding or removing an agent requires editing orchestrator code. | Medium — reduces extensibility. Future agents require orchestrator code change. |
| **`any` type erosion** | All agents | `Agent<TInput, TOutput>` interface exists but most agents use `any` for input and output types. Type safety is advisory, not enforced. | Low — currently all agents handle their types correctly, but new agents have no compiler guard. |
| **Industry knowledge dependency chain** | Planner, Director | Both depend on `lib/industry-knowledge.ts`. If the industry profile changes, both agents are affected. | Low — single source of truth for industry data. |
| **Business profile coupling** | Mascot Designer + Planner | Both read `businessProfile` from clientInfo. Business profile changes affect both modules. | Low — business profile is a stable input. |

### Coupling Summary

```
Strong:   2 pairs (Analyst→Planner, Guardian→Composer)
Weak:     3 pairs (Planner+Mascot, Mascot↔Director, Planner↔Director)
Implicit: 4 items (Context pollution, Hardcoded map, Any type, Shared industry knowledge)
```

---

## 5. Memory Access Matrix

| Agent | Read | Write | Entity Type |
|-------|------|-------|-------------|
| Orchestrator | ✅ (start) | ✅ (end) | ClientMemory, ProjectMemory, MemoryIndex |
| Brand Analyst | — | — | — |
| Brand Planner | — | — | — |
| Mascot Designer | — | — | — |
| Design Director | — | — | — |
| Asset Guardian | — | — | — |
| Manual Composer | — | — | — |

**Key observation:** Memory access is centralized in the Orchestrator. Individual agents have zero memory I/O. This is a clean separation of concerns — agents focus on analysis/decision, the Orchestrator handles persistence.

### Memory Write Strategy

| Condition | Action |
|-----------|--------|
| Pipeline succeeded + brandProfile exists | Write ClientMemory (create or update) + ProjectMemory (append snapshot) + update Index |
| Pipeline failed | No memory write |
| Memory write fails | Warn only — pipeline result still returned to caller |
| Client already exists | Update existing ClientMemory (merge project IDs, update timestamps) |
| Client new | Create ClientMemory with new clientId |

---

## 6. Asset Access Matrix

| Agent | Logo | IP Mascot | Colors | Prompt Content |
|-------|------|-----------|--------|----------------|
| Brand Analyst | Count only | Count only | Reads brandColors | — |
| Brand Planner | — | — | — | — |
| Mascot Designer | — | Existence check | — | — |
| Design Director | — | — | — | — |
| Asset Guardian | **Full access** (URLs, policy) | **Full access** (URLs, policy) | — | **Scans prompts** for protected references |
| Manual Composer | Reads URL for payload | Reads URL for payload | Reads brandColors | — |
| Orchestrator | — | — | — | — |

**Key observation:** Only Asset Guardian and Manual Composer have deep asset access. This follows the principle of least privilege — analysis agents only see asset existence, not content.

---

## 7. Failure Mode Registry

| Agent | Failure | Behavior | Recovery |
|-------|---------|----------|----------|
| Brand Analyst | Low confidence | Warns, continues | Client can supplement info |
| Brand Analyst | Missing philosophy fields | Warns, continues | Client can supplement |
| Brand Analyst | Exception | `success: false`, pipeline stops | (depends on stopOnError) |
| Brand Planner | Low page count (< 8) | Warns, continues | Client or operator review |
| Brand Planner | High page count (> 30) | Warns, continues | Client or operator review |
| Brand Planner | Exception | `success: false`, pipeline stops | — |
| Mascot Designer | Low confidence optional | Warns, continues with client consultation suggestion | Client confirmation needed |
| Mascot Designer | Exception | `success: false`, pipeline stops | — |
| Design Director | All defaults | Continues with default color/typography schemes | Acceptable fallback |
| Design Director | Exception | `success: false`, pipeline stops | — |
| Asset Guardian | No protected assets found | Warns, continues. `isGenerationSafe = true`. | Potential gap — brand may have assets not detected |
| Asset Guardian | Prohibited prompt content | Logs violations, `isGenerationSafe = false`. | Requires operator intervention |
| Asset Guardian | Exception | `success: false`, pipeline stops | — |
| Manual Composer | Missing pagePlan | `success: false` | Must re-run Planner |
| Manual Composer | Generation API failure | `success: false` | Infrastructure issue |
| Manual Composer | Guard blocked | `canExecute()` returns false | Must resolve asset violations first |
| Orchestrator | Memory read failure | Warns, continues (degraded mode) | Memory features unavailable |
| Orchestrator | Memory write failure | Warns, continues | Data not persisted this run |
| Orchestrator | Agent execution error | Breaks pipeline (default stopOnError=true) | Manual re-run after fix |

---

## 8. Agent Input/Output Contract Summary

```yaml
agents:
  brand-analyst:
    input:  clientInfo (raw submission data)
    output: BrandProfile

  brand-planner:
    input:  BrandProfile
    output: ModulePlan + PagePlan + ResourceEstimate

  mascot-designer:
    input:  BrandProfile + clientInfo.businessProfile
    output: MascotProfile
    side_effect: Orchestrator module boost (+25 score)

  design-director:
    input:  BrandProfile + IndustryProfile
    output: DesignDirection

  asset-guardian:
    input:  clientInfo + prompts (optional)
    output: AssetGuardianOutput + isGenerationSafe gate

  manual-composer:
    input:  ModulePlan + DesignDirection + AssetGuardianOutput
    output: GenerationInitiation

  orchestrator:
    input:  clientInfo + projectId + mode
    output: PipelineResult + MemoryWrites
```

---

## 9. Findings & Recommendations

### 9.1 Observations

| # | Observation | Severity | Detail |
|---|-------------|----------|--------|
| O1 | **Agents are well-encapsulated** | ✅ Positive | Each agent has clear inputs, outputs, and preconditions. No agent reaches outside its scope. |
| O2 | **Memory access is properly centralized** | ✅ Positive | Only Orchestrator touches memory. Agents remain stateless. |
| O3 | **Asset access follows least privilege** | ✅ Positive | Only Asset Guardian and Manual Composer see asset content. Analysis agents see only existence. |
| O4 | **No agent-level unit tests** | ⚠️ Gap | Only Wanxiang provider and mascot-prompt-strategy have `__tests__`. Core agent logic is untested. |
| O5 | **`any` types weaken the contract** | ⚠️ Gap | Despite typed `Agent<TInput, TOutput>` interface, most agents use `any` for input/output. |

### 9.2 Recommendations

1. **Consider parallel execution** — Mascot Designer and Design Director have no data dependency. They could run in parallel within the `full` pipeline, reducing total execution time.

2. **Add `stopOnError` configuration** — Orchestrator currently hardcodes `stopOnError = true`. Making this configurable would allow `analyze-only` and `plan-only` modes to be more resilient.

3. **Replace `any` types with concrete types** — Each agent's input/output types should be explicit, e.g.:
   - `BrandAnalystAgent: Agent<clientInfo, BrandProfile>`
   - `BrandPlannerAgent: Agent<BrandProfile, ModulePlan>`

4. **Add agent-level unit tests** — Core logic (recommendMascot, deriveColorStrategy, etc.) is pure and easily testable.

---

> **This document is a read-only analysis. No code changes were made.**
> **All findings are based on the state of the codebase at the time of discovery.**
> **Ready for Agent Architecture Review.**
