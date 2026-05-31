# Architecture Audit Report

> Generated: 2026-05-31
> Scope: Read-only scan of /docs, /src (app, components, lib, agents, providers)
> Mode: TASK-001 — no code modifications

---

## 1. Document Audit

### 1.1 Document Inventory

| Document | Path | Status | Coverage |
|----------|------|--------|----------|
| PROJECT_MASTER.md | `/PROJECT_MASTER.md` | ✅ Up-to-date | Project positioning, constraints, completed modules, next milestones |
| PROJECT_HANDOVER.md | `/docs/PROJECT_HANDOVER.md` | ✅ Updated for governance | v0.7-alpha, Governance V2 phase, task freeze list |
| HANDOVER.md | `/docs/HANDOVER.md` | ⚠️ Stale | Older version, Mascot Designer listed as "planned", conflicts with PROJECT_HANDOVER.md |
| AI_CONTEXT.md | `/docs/AI_CONTEXT.md` | ✅ Up-to-date | Quick AI assistant reference, core principles, forbidden ops |
| AGENTS.md | `/docs/AGENTS.md` | ⚠️ Partially outdated | Mascot Designer listed as "Future Agent #7 (planned)" but it's already implemented |
| ARCHITECTURE.md | `/docs/ARCHITECTURE.md` | ⚠️ Minor drift | plan-only mode description differs from orchestrator code |
| MEMORY_SYSTEM.md | `/docs/MEMORY_SYSTEM.md` | ✅ Accurate | Storage strategy, types, adapter interface, data flow |
| QUALITY_SCORE.md | `/docs/QUALITY_SCORE.md` | ✅ Accurate | 5-dimension scoring, risks, package-specific checks |
| Knowledge (00-06) | `/docs/knowledge/` | ✅ Good structure | 7 documents + extracted raw content. Solid foundation |

### 1.2 Responsibility Overlap

| Area | Documents | Overlap Level | Assessment |
|------|-----------|---------------|------------|
| Agent pipeline description | MASTER, AI_CONTEXT, ARCHITECTURE, AGENTS | 🔴 High | Same pipeline described in 4 places; risk of drift |
| Core principles | MASTER, AI_CONTEXT | 🟡 Medium | Intentional (AI_CONTEXT is the quick version of MASTER) |
| Handover state | HANDOVER.md, PROJECT_HANDOVER.md | 🔴 High | Both exist. HANDOVER.md is stale but not removed, creates confusion |
| Forbidden operations | MASTER, AI_CONTEXT, PROJECT_HANDOVER | 🟡 Medium | Consistent content but triplicated |
| Architecture diagrams | ARCHITECTURE.md, MASTER | 🟡 Medium | ARCHITECTURE.md has the canonical view, MASTER has simplified version |

### 1.3 Key Finding: Agent Count Mismatch

Multiple documents state "7 agents + orchestrator" but the code base contains exactly **6 agent implementations** + 1 orchestrator:

- `src/agents/types.ts` — `AgentId` union has 6 values
- `src/agents/` — 6 agent files + 1 orchestrator
- `src/agents/index.ts` — exports exactly 6 agents

| Document | Claims | Actual |
|----------|--------|--------|
| MASTER.md | "7 agents + orchestrator" | 6 + orchestrator |
| AI_CONTEXT.md | "7 Agent + Orchestrator" | 6 + orchestrator |
| AGENTS.md | 6 agents listed + 1 future | 6 implemented |
| ARCHITECTURE.md | "6 Agent + Orchestrator" | ✅ Correct |

---

## 2. Architecture Audit

### 2.1 Agent-to-Code Mapping

| Agent | Code File | Status | Dependencies | Executes |
|-------|-----------|--------|--------------|----------|
| Brand Analyst | `src/agents/brand-analyst.ts` | ✅ Complete | `lib/brand-analyzer.ts`, `lib/brand-dictionary.ts` | canExecute → execute |
| Brand Planner | `src/agents/brand-planner.ts` | ✅ Complete | `lib/module-planner.ts`, `lib/module-to-page.ts` | canExecute → execute |
| Mascot Designer | `src/agents/mascot-designer.ts` | ✅ Complete | Pure function `recommendMascot()` | canExecute → execute |
| Design Director | `src/agents/design-director.ts` | ✅ Complete | `lib/industry-knowledge.ts` | canExecute → execute |
| Asset Guardian | `src/agents/asset-guardian-agent.ts` | ✅ Complete | `lib/asset-guardian.ts` | canExecute → execute |
| Manual Composer | `src/agents/manual-composer.ts` | ✅ Complete | Generation pipeline | canExecute → execute |
| Orchestrator | `src/agents/orchestrator.ts` | ✅ Complete | All 6 agents + Memory | Sequential dispatch |

**All 7 modules (6 agents + 1 orchestrator) have working code implementations.**

### 2.2 Orchestrator Mode Discrepancy

| Mode | ARCHITECTURE.md Description | Code (`orchestrator.ts`) | Match |
|------|----------------------------|--------------------------|-------|
| `analyze-only` | Brand Analyst only | `["brand-analyst"]` | ✅ |
| `plan-only` | Brand Analyst → Brand Planner → **Mascot Designer** | `["brand-analyst", "brand-planner"]` | ❌ Doc includes Mascot Designer |
| `full` | All agents | All 6 in sequence | ✅ |
| `generate-only` | Not documented | `["asset-guardian", "manual-composer"]` | ⚠️ Missing from doc |

### 2.3 Decision Layer Steps

| Source | Steps | Match |
|--------|-------|-------|
| Code (`DecisionLayer.tsx`) | 5 steps (Analysis, Business Profile, Modules, Generate, Preview) | — |
| ARCHITECTURE.md | 4 steps | ❌ Missing "Business Profile" as a step |
| AI_CONTEXT.md | 5 steps | ✅ |
| PROJECT_CONTEXT.md (root) | 4 steps | ❌ |

### 2.4 Memory System

| Aspect | Doc Says | Code Does | Match |
|--------|----------|-----------|-------|
| Storage path | `public/memory/` | `public/memory/` | ✅ |
| File format | JSON | JSON | ✅ |
| Data structures | ClientMemory, IndustryMemory, ProjectMemory | As defined in `memory/types.ts` | ✅ |
| 3-level memory | Client / Industry / Project | All 3 implemented | ✅ |
| 18 preload industries | Yes | `initializeMemorySystem()` loads from `industry-knowledge.ts` | ✅ |

**Memory files verified on disk:**
- `public/memory/index.json` (1.1 KB)
- `public/memory/clients.json` (513 B)
- `public/memory/industries.json` (19 KB)
- `public/memory/projects.json` (32 KB)

### 2.5 IP Image Provider (Wanxiang)

| Provider | File | Status |
|----------|------|--------|
| Wanxiang | `lib/ip-image-provider/wanxiang-provider.ts` | ✅ Implemented with SSE streaming |
| Mock | `lib/ip-image-provider/mock-provider.ts` | ✅ Fallback |
| Flux | `lib/ip-image-provider/flux-provider.ts` | ✅ Stub |
| Midjourney | `lib/ip-image-provider/midjourney-provider.ts` | ✅ Stub |
| Metrics | `lib/ip-image-provider/metrics-provider.ts` | ✅ Provider metrics V1 |

---

## 3. Risk Assessment

### 🔴 High Risks

| # | Risk | File/Location | Description |
|---|------|---------------|-------------|
| H1 | **Documentation Drift — Mascot Designer** | `/docs/AGENTS.md` | AGENTS.md still lists Mascot Designer as "Future Agent #7 (planned)" when it's fully implemented in `src/agents/mascot-designer.ts`. Any new AI assistant reading AGENTS.md will be misled. |
| H2 | **Duplicate Handover** | `/docs/HANDOVER.md` vs `/docs/PROJECT_HANDOVER.md` | Two handover documents coexist. HANDOVER.md is stale (lists Mascot Designer as P0-todo, names Mascot Designer Agent as uncompleted when it's done). New assistants may read the wrong file. |
| H3 | **Orchestrator Mode Doc/Code Mismatch** | `ARCHITECTURE.md` vs `orchestrator.ts` | `plan-only` mode documented as including Mascot Designer but code only runs Brand Analyst + Brand Planner. Agents reading ARCHITECTURE.md will have incorrect expectations about pipeline behavior. |

### 🟡 Medium Risks

| # | Risk | File/Location | Description |
|---|------|---------------|-------------|
| M1 | **Quality Score Not Integrated** | `lib/manual-quality-score.ts` | Scoring logic is complete but never triggered in the generation pipeline (`generate-manual-pages-stream`). Quality assessments are not being produced in production flow. |
| M2 | **Memory Path Not Verified at Runtime** | `lib/memory/json-adapter.ts` | Uses `process.cwd() + "public/memory/"` which depends on runtime working directory. No verification that the path resolves correctly in production (Vercel). |
| M3 | **Project Root Noise** | `/` (~40+ `_*.py`, `_*.ts`, `_*.js` files) | Helper scripts, fix scripts, test files clutter the project root. Not tracked in git (likely), but confusing. |
| M4 | **Backup Files in Source Tree** | `src/app/**/*.bak` | `page.tsx.bak` and `route.ts.bak` remain in the source tree. Could be accidentally committed. |
| M5 | **Decision Layer Steps Vary** | ARCHITECTURE.md vs code | Differing step counts (4 vs 5) between documentation sources. Minor but causes confusion. |

### 🟢 Low Risks

| # | Risk | File/Location | Description |
|---|------|---------------|-------------|
| L1 | **API Key in .env.local** | `.env.local` | `DEEPSEEK_API_KEY` and `ALIYUN_API_KEY` stored locally. Key rotation risk if leaked. |
| L2 | **No Agent Unit Tests** | `lib/__tests__/` | Only Wanxiang provider and mascot-prompt-strategy have tests. Core agent logic (brand-analyst, brand-planner, design-director, orchestrator) has zero unit tests. |
| L3 | **Agent Contract Not Enforced at Type Level** | `agents/types.ts` | `Agent<TInput, TOutput>` interface exists but agents use `any` as input/output types, reducing contract value. Type safety is advisory. |
| L4 | **Memory Edge Cases** | `memory/json-adapter.ts` | File race conditions possible under concurrent requests (no file locking). `public/memory/` is not writable on Vercel read-only filesystem. |
| L5 | **Mascot Designer Not in Default Sequence Doc** | AGENTS.md flow diagram | The default sequence diagram in AGENTS.md shows 5 agents without Mascot Designer, but `orchestrator.ts` includes it. |

---

## 4. Summary

### What's Healthy

- All 6 agents + orchestrator are fully implemented and match their intended responsibilities
- Memory system (V1) is stable with JSON persistence working correctly
- Wanxiang provider has SSE streaming, fallback, and metrics
- Knowledge documentation (06 series) is well structured with extracted reference content
- Core constraints (Asset Guardian, no AI-redraw, PAGE_DEFS preservation) are enforced in code

### What Needs Attention (Priority Order)

1. **H1 + H2**: Consolidate AGENTS.md and remove stale HANDOVER.md — highest risk for AI assistant onboarding
2. **H3**: Fix ARCHITECTURE.md `plan-only` mode description to match code
3. **M1**: Integrate Quality Score into the generation pipeline callback
4. **M3 + M4**: Clean up project root noise and `.bak` files
5. **M5**: Unify Decision Layer step count across all docs

### Verification

- ✅ All items are read-only scan results — zero code modifications
- ✅ No new files created outside `/docs/`
- ✅ Findings cross-referenced between documentation and actual code
- ✅ Ready for review before proceeding to TASK-002
