# Brand Brain — Architecture SSOT

> **Single Source of Truth for Brand Brain Architecture**
> Version: 1.0
> Created: 2026-05-31
> Status: Governance Draft (awaiting Architecture Review)
>
> All downstream documentation inherits from this document.
> This is the canonical architecture reference, not a replacement for existing docs.

---

## 1. Product Identity

### What Brand Brain Is

Brand Brain is an **AI brand consultancy system** — not an AI image generator.

Its core value lies in:
- **Brand analysis capability** — understanding brand type, persona, positioning, archetype, voice
- **Industry knowledge system** — structured visual characteristics across 18+ industries
- **Module planning capability** — double-factor scoring (brand 60% + business 40%)
- **Quality assessment system** — 5-dimension automated scoring
- **Long-term memory system** — Client / Industry / Project memory with JSON persistence

### What Brand Brain Does

```
Client submits brand materials and requirements
  ↓
Brand Brain analyzes, plans, designs, protects, and composes
  ↓
Output: a structured VI manual with brand-aligned visual direction
```

### What Brand Brain Is Not

- Not an image rendering engine
- Not a logo designer
- Not a mascot creator
- Not a PDF generator (it orchestrates generation, but generation is a downstream concern)

### Core Constraints

| Constraint | Description |
|------------|-------------|
| Logo is protected | Cannot be AI-redrawn, recolored, or redesigned. Only scale, move, layout |
| Existing IP is protected | Cannot be AI-redrawn, recolored, re-materialled, or re-expressed |
| PAGE_DEFS preserved | Legacy generation layer is stable and frozen |
| Asset Guardian mandatory | Protection logic cannot be bypassed |
| Memory First | No generation without prior memory read/write |
| Decision Layer > Visual Layer | Ensure analysis is correct before optimizing visuals |

---

## 2. Seven-Layer Architecture

The official Brand Brain architecture is a **seven-layer stack**, each layer depending on the one below it.

```
┌─────────────────────────────────────┐
│         7. Memory Layer             │
│  (Client / Industry / Project)      │
├─────────────────────────────────────┤
│         6. Manual Generation        │
│  (Page Planner → Render Blueprint   │
│   → SVG Synthesis / Image Gen)      │
├─────────────────────────────────────┤
│         5. Governance Layer         │
│  (Asset Guardian, Quality Gate)     │
├─────────────────────────────────────┤
│         4. Creative Agents          │
│  (Design Director, Mascot Designer) │
├─────────────────────────────────────┤
│         3. Planning Layer           │
│  (Brand Planner, Module Planner)    │
├─────────────────────────────────────┤
│         2. Analysis Layer           │
│  (Brand Analyst, Industry Knowledge)│
├─────────────────────────────────────┤
│         1. Knowledge Layer          │
│  (Knowledge Docs, Reference PDFs,   │
│   Anti-Pattern Library, Case Memory)│
└─────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Purpose | Key Components |
|-------|---------|----------------|
| **1. Knowledge** | Domain expertise, reference materials, extracted knowledge | `docs/knowledge/`, `industry-knowledge.ts`, extracted PDFs |
| **2. Analysis** | Understand client brand from raw input | `brand-analyst.ts`, `brand-dictionary.ts` |
| **3. Planning** | Determine manual structure, modules, package | `module-planner.ts`, `module-to-page.ts`, `manual-packages.ts` |
| **4. Creative** | Make visual and IP design decisions | `design-director.ts`, `mascot-designer.ts` |
| **5. Governance** | Enforce brand asset protection, quality thresholds | `asset-guardian.ts`, `manual-quality-score.ts` |
| **6. Generation** | Produce the actual manual pages | `page-planner.ts`, `render-blueprint.ts`, `ai-layout-planner.ts`, `generate-manual-pages-stream/` |
| **7. Memory** | Persist and retrieve knowledge across sessions | `memory/` (types, json-adapter, index) |

### Data Flow (End-to-End)

```
Client Input (companyName, industry, brandVision, assets, businessProfile)
    ↓
[Layer 2] Brand Analyst → BrandProfile (type, persona, positioning, archetype, voice)
    ↓
[Layer 3] Brand Planner → ModulePlan (modules, scores, package recommendation, page plan)
    ↓
[Layer 4] Mascot Designer → MascotProfile (mode, traits, recommendations)
    ↓
[Layer 4] Design Director → DesignDirection (color, typography, image style)
    ↓
[Layer 5] Asset Guardian → AssetGuardResult (protection policy, violations, negative prompt)
    ↓
[Layer 6] Manual Composer → Generation Pipeline (page IDs → render → image)
    ↓
[Layer 5] Quality Score → Quality assessment (5 dimensions, risk flags)
    ↓
[Layer 7] Memory System → Save ClientMemory / ProjectMemory / IndustryMemory
```

---

## 3. Agent Registry

### Current Agents (6 + 1 Orchestrator)

| # | Agent | File | Version | Purpose |
|---|-------|------|---------|---------|
| 1 | Brand Analyst | `src/agents/brand-analyst.ts` | 1.0.0 | Analyze brand → brand type, persona, positioning, archetype, voice |
| 2 | Brand Planner | `src/agents/brand-planner.ts` | 1.0.0 | Plan manual structure → module scores, package, page IDs |
| 3 | Mascot Designer | `src/agents/mascot-designer.ts` | 1.0.0 | IP mascot strategy → protect/create/optional/not-needed |
| 4 | Design Director | `src/agents/design-director.ts` | 1.0.0 | Visual direction → color, typography, image style |
| 5 | Asset Guardian | `src/agents/asset-guardian-agent.ts` | 1.0.0 | Protect brand assets → scan prompts, enforce policy |
| 6 | Manual Composer | `src/agents/manual-composer.ts` | 1.0.0 | Orchestrate generation → page plan → render pipeline |
| — | Orchestrator | `src/agents/orchestrator.ts` | 1.0.0 | Sequential dispatch, context management, memory I/O |

### Agent Interface

```typescript
interface Agent<TInput, TOutput> {
  identity: AgentIdentity;              // id, name, description, version
  execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;
  canExecute(context: AgentContext): Promise<{ canRun: boolean; reason?: string }>;
}
```

All agents share state via `AgentContext`, which accumulates outputs sequentially.

### Agent Registration

All agents are exported from `src/agents/index.ts` and registered in `orchestrator.ts` via `agentMap`.

### Default Execution Sequence

```
brand-analyst → brand-planner → mascot-designer → design-director → asset-guardian → manual-composer
```

---

## 4. Pipeline Modes

The orchestrator supports 4 modes, controlling which subset of agents execute:

| Mode | Agent Sequence | Use Case | Status |
|------|---------------|----------|--------|
| `analyze-only` | `[brand-analyst]` | Quick brand analysis, no planning | ✅ |
| `plan-only` | `[brand-analyst, brand-planner]` | Brand analysis + module planning (used by `/api/brand/analyze`) | ✅ |
| `full` | `[brand-analyst → brand-planner → mascot-designer → design-director → asset-guardian → manual-composer]` | End-to-end brand brain pipeline | ✅ |
| `generate-only` | `[asset-guardian, manual-composer]` | Skip analysis, generate from existing plan | ✅ |

### Mode Selection

Mode is set when calling `executeBrandBrainPipeline()`:
```typescript
executeBrandBrainPipeline(clientInfo, projectId, { mode: "plan-only" })
```

The `full` mode runs all 6 agents sequentially. Each agent's `canExecute()` is called before execution; if prerequisites are not met, the agent is skipped with an error logged.

### Orchestrator Events (SSE-compatible)

```typescript
type OrchestratorEventType =
  | "orchestrator:start"
  | "agent:start"
  | "agent:complete"
  | "agent:error"
  | "orchestrator:complete"
  | "orchestrator:error";
```

The orchestrator supports a callback interface for real-time progress reporting to the frontend.

---

## 5. Governance Rules

All governance rules are mandatory and cannot be bypassed, skipped, or removed.

### Rule 1: Memory First

```
Before any analysis:
  → Read ClientMemory (if client exists)
  → Read ProjectMemory (if project exists)

After any analysis:
  → Write ClientMemory (update or create)
  → Write ProjectMemory (append snapshot)
  → Update MemoryIndex
```

Enforced in: `orchestrator.ts` memory read/write blocks.

### Rule 2: Asset Guardian Required

```
Every generation request MUST pass through Asset Guardian:
  → Extract protected assets (Logo, IP)
  → Scan prompts for prohibited references
  → Generate negative prompt
  → Block if violations found

Asset Guardian CANNOT be:
  - Removed from the agent pipeline
  - Skipped via mode selection
  - Bypassed with a mock/stub implementation
```

Enforced in: `orchestrator.ts` — Asset Guardian is always included in `full` and `generate-only` modes.

### Rule 3: Quality Gate Required

```
After every manual generation:
  → Run Quality Score (5 dimensions, 0-100)
  → If totalScore < 75 → flag "needs_revision"
  → If assetProtection < 15 → flag "critical_asset_risk"
  → Write results to ProjectMemory.qualityScore
```

Note: Quality Score logic is implemented (`lib/manual-quality-score.ts`) but **not yet triggered** in the generation pipeline. This is a known gap tracked in the Governance Backlog.

---

## 6. Freeze Zones

The following layers and components are **frozen** — no modifications, refactoring, or replacements permitted without explicit Architecture Review approval.

### Frozen Components

| Zone | Files | Scope |
|------|-------|-------|
| **Generation Layer** | `src/lib/page-planner.ts`, `src/lib/render-blueprint.ts`, `src/lib/ai-layout-planner.ts`, `src/app/api/ai/generate-manual-pages-stream/route.ts` | Full pipeline from module-to-page to image output |
| **PAGE_DEFS** | (embedded in generation layer) | Page definitions and layout templates |
| **SVG Layer** | SVG synthesis and composition | SVG generation, `<image>` references |
| **Cover Layer** | Cover page generation | Front cover design and generation |
| **Font Layer** | Font selection and rendering | Typography system |
| **Asset Guardian (implementation)** | `src/lib/asset-guardian.ts`, `src/agents/asset-guardian-agent.ts` | Protection rules and enforcement |

### Freeze Rules

- No new features in frozen zones
- No refactoring of frozen code
- No replacement of frozen components
- Bug fixes only — and must be approved by Architecture Review first
- New functionality must be added as new files, not modifications to frozen files

### Rationale

The generation layer was inherited from the pre-Brand-Brain era (`vi-ai-logo-ip-mock` v1). It is stable, tested, and production-verified. The architectural strategy is to **add decision layers on top** rather than modify the existing foundation.

---

## 7. Documentation Ownership

### Document Hierarchy

| Document | Role | Owner | Update Cadence | Inherits From |
|----------|------|-------|----------------|---------------|
| **PROJECT_MASTER.md** | **Strategic Truth** — project positioning, completed modules, milestones, core constraints | ChatGPT + Architecture Review | Per milestone (L3 commit) | ARCHITECTURE_SSOT |
| **PROJECT_HANDOVER.md** | **Operational Truth** — current version, current phase, active task, freeze state, last checkpoint snapshot | Codex | Per conversation switch | PROJECT_MASTER, ARCHITECTURE_SSOT |
| **AI_CONTEXT.md** | **AI Runtime Truth** — quick-start for AI assistants entering the project, must-read before any work | ChatGPT + Codex | Per milestone | PROJECT_MASTER, ARCHITECTURE_SSOT |
| **ARCHITECTURE_SSOT.md** | **Architecture Truth** — canonical architecture, agent registry, governance rules, freeze zones | Architecture Review | When architecture changes | (none — this is the root) |

### Inheritance Rules

```
ARCHITECTURE_SSOT  (root — architecture truth)
    ↓
PROJECT_MASTER    (inherits architecture → adds strategic context)
    ↓
PROJECT_HANDOVER  (inherits strategy → adds operational state)
    ↓
AI_CONTEXT        (inherits strategy + operations → adds AI runtime context)
    ↓
docs/knowledge/   (independent — domain knowledge, not architecture)
docs/AGENTS.md    (inherits agent registry from ARCHITECTURE_SSOT)
docs/ARCHITECTURE.md  (superseded by ARCHITECTURE_SSOT, preserved for legacy reference)
```

### What Each Document Must Always Contain

| Requirement | MASTER | HANDOVER | AI_CONTEXT | SSOT |
|-------------|--------|----------|------------|------|
| Product positioning | ✅ | — | ✅ | ✅ |
| Current stage | ✅ | ✅ | ✅ | — |
| Architecture overview | ✅ | — | ✅ | ✅ (canonical) |
| Agent list | ✅ | — | ✅ | ✅ (registry) |
| Freeze zones | ✅ | ✅ | — | ✅ |
| Governance rules | — | — | — | ✅ |
| Current task | — | ✅ | — | — |
| Forbidden operations | ✅ | ✅ | ✅ | — |
| Quick file reference | ✅ | — | ✅ | — |

---

## 8. Known Architecture Drift (Recorded, Not Fixed)

The following issues were identified during TASK-001 (Architecture Audit) and are recorded here for governance tracking. They are **not to be fixed in this task** — they will be resolved during subsequent governance phases.

| # | Issue | Location | Description | Target Resolution |
|---|-------|----------|-------------|-------------------|
| D1 | **Duplicate Handover** | `/docs/HANDOVER.md` vs `/docs/PROJECT_HANDOVER.md` | Two handover documents coexist. HANDOVER.md is stale (lists Mascot Designer as P0-todo). Risk: new AI reads wrong file and gets incorrect project state. | Governance Phase — document consolidation |
| D2 | **AGENTS.md Mascot Designer Status** | `/docs/AGENTS.md` (#7 Future Agent) | AGENTS.md lists Mascot Designer as "Future Agent #7 (planned)" but it is fully implemented in `src/agents/mascot-designer.ts`. | Governance Phase — document update |
| D3 | **ARCHITECTURE.md plan-only Drift** | `/docs/ARCHITECTURE.md` | plan-only mode described as "Brand Analyst → Brand Planner → Mascot Designer" but code runs only `[brand-analyst, brand-planner]`. | Governance Phase — document update |
| D4 | **Decision Layer Step Count** | `ARCHITECTURE.md` (4 steps) vs code / `AI_CONTEXT.md` (5 steps) | Step count varies. DecisionLayer.tsx implements 5 steps but ARCHITECTURE.md describes 4. | Governance Phase — document update |

### Drift Classification

All four items are **documentation drift only** — no code changes required, no behavioral impact, no data integrity risk.

---

## Appendix A: Directory Map

```
vi-ai-logo-ip-mock/
├── docs/
│   ├── ARCHITECTURE_SSOT.md    ← THIS FILE (source of truth)
│   ├── ARCHITECTURE.md         ← Legacy (superseded, preserved for reference)
│   ├── PROJECT_MASTER.md       ← Strategic truth
│   ├── PROJECT_HANDOVER.md     ← Operational truth (active)
│   ├── HANDOVER.md             ← Operational truth (stale — see D1)
│   ├── AI_CONTEXT.md           ← AI runtime truth
│   ├── AGENTS.md               ← Agent reference (superseded by SSOT §3)
│   ├── MEMORY_SYSTEM.md        ← Memory design doc
│   ├── QUALITY_SCORE.md        ← Quality system doc
│   ├── AUDIT_REPORT.md         ← TASK-001 output
│   ├── knowledge/              ← Knowledge layer (07 docs + extracted content)
│   └── ...                     ← Other design docs
│
└── src/
    ├── agents/                  ← Agent implementations (7 modules: 6 agents + 1 orchestrator)
    ├── lib/
    │   ├── memory/              ← Memory system (types, json-adapter, index)
    │   ├── brand-analyzer.ts    ← Analysis layer engine
    │   ├── industry-knowledge.ts← Knowledge layer engine (18 industries)
    │   ├── module-planner.ts    ← Planning layer engine
    │   ├── module-to-page.ts    ← Planning → Generation bridge
    │   ├── manual-packages.ts   ← Package definitions
    │   ├── business-profile.ts  ← Business profile scoring
    │   ├── asset-guardian.ts    ← Governance engine
    │   ├── manual-quality-score.ts ← Quality gate engine
    │   ├── mascot-prompt-strategy.ts ← IP prompt generation
    │   └── ip-image-provider/   ← Image provider layer (Wanxiang, Mock, Flux, MJ)
    ├── components/
    │   ├── admin/
    │   │   └── DecisionLayer.tsx← 5-step decision UI
    │   └── ...                  ← UI components
    └── app/
        ├── api/brand/analyze/   ← Brand analysis API (plan-only mode)
        ├── api/ai/              ← AI generation APIs
        └── ...                  ← Page routes
```

---

## Appendix B: Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-31 | Codex (TASK-002) | Initial Architecture SSOT — 7-layer model, agent registry, governance rules, freeze zones, documentation ownership, drift log |

---

> **This document is the architecture truth for Brand Brain. All architectural decisions, agent registrations, governance rules, and freeze zone definitions originate here. No other document should be treated as authoritative for architecture questions.**
