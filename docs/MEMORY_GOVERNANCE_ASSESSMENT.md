# Memory Governance Assessment

> **Read-only audit of Brand Brain Memory System V1**
> Generated: 2026-05-31
> Scope: `src/lib/memory/`, `public/memory/`, `orchestrator.ts` memory I/O, data model, lifecycle
> Mode: TASK-004 — no code modifications, no data migration

---

## 1. Current Memory Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory System V1                          │
│                    src/lib/memory/                           │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │  types   │──▶│ json-adapter │──▶│    index.ts       │   │
│  │.ts       │   │ .ts          │   │ (init + exports)  │   │
│  └──────────┘   └──────┬───────┘   └───────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────────┐                        │
│              │   public/memory/    │                        │
│              │  ┌───────────────┐  │                        │
│              │  │ index.json    │  │  (memory system index) │
│              │  │ clients.json  │  │  (all clients)        │
│              │  │ industries.   │  │  (industry knowledge) │
│              │  │   json        │  │                        │
│              │  │ projects.json │  │  (all projects)       │
│              │  └───────────────┘  │                        │
│              └─────────────────────┘                        │
│                                                             │
│  Only consumer: Orchestrator (via getMemoryAdapter())       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Current State | Rationale |
|----------|--------------|-----------|
| Storage format | JSON files | Zero-config development, easy inspection |
| Storage location | `public/memory/` | Public directory for easy access during dev |
| Access pattern | Singleton adapter, full-file read/write | Simple, no DB driver needed |
| Client ID generation | `companyName.replace(/[\s\/]/g, "_")` | Simple but fragile (encoding issues) |
| Data model | 3 entity types + 1 index | Covers current needs: Client, Industry, Project |

### Dependencies

```
orchestrator.ts
    │
    ├── getMemoryAdapter()          ← singleton from json-adapter.ts
    ├── .findClientByCompany()      ← reads clients.json
    ├── .getProject()               ← reads projects.json
    ├── .saveClient()               ← writes clients.json
    ├── .saveProject()              ← writes projects.json
    └── (implicit) .updateIndex()   ← writes index.json

lib/memory/index.ts
    │
    └── initializeMemorySystem()    ← called on first /api/brand/analyze
        ├── .getAllIndustries()     ← reads industries.json
        ├── getAllIndustryProfiles()← lib/industry-knowledge.ts
        ├── .saveIndustry()         ← writes each industry to industries.json
        └── getSubCategories()      ← lib/industry-knowledge.ts
```

---

## 2. Memory Data Model

### Entity: ClientMemory

| Field | Type | Current Value (Example) | Risk |
|-------|------|------------------------|------|
| `clientId` | `string` | `"椰岛工坊"` (garbled in storage) | 🔴 Encoding — Chinese chars may be stored incorrectly |
| `companyName` | `string` | `"椰岛工坊"` (garbled) | 🔴 Same encoding issue |
| `industryCategory` | `string` | `"food_beverage"` | ✅ Stable enum |
| `projectIds[]` | `string[]` | `["VI-20260528-NDKW"]` | ✅ |
| `latestMascotProfile` | `any` | (field declared, not populated in test data) | 🟡 Field exists but untested |
| `targetAudience` | `string?` | (garbled Chinese) | 🟡 Optional, encoding risk |

**Issue discovered**: `clientId` is generated via `companyName.replace(/[\s\/]/g, "_")` which works for ASCII but produces garbled results for CJK characters (PowerShell encoding mismatch).

### Entity: IndustryMemory

| Field | Type | Current State | Risk |
|-------|------|---------------|------|
| `industryKey` | `string` | `"food_beverage"`, `"food_beverage/coconut_water"` etc. | ✅ Well-structured hierarchy |
| `designStyle[]` | `string[]` | 4 styles per industry | ✅ Populated from `industry-knowledge.ts` |
| `colorTendency[]` | `string[]` | 3 tendencies per industry | ✅ |
| `typicalScenes[]` | `string[]` | All empty | 🟡 Declared but never populated |
| `source` | `"initial_knowledge"` | All 17 entries | 🟡 No mechanism to promote to `"project_accumulated"` |
| `projectCount` | `number` | All 0 | 🟡 Never incremented — no accumulation logic |
| `confidence` | `number` | All 0.8 | 🟡 Static — never adjusted by actual experience |

### Entity: ProjectMemory

| Field | Type | Current State | Risk |
|-------|------|---------------|------|
| `projectId` | `string` | `"VI-20260528-NDKW"` | ✅ Unique |
| `brainResults[]` | `BrainResultSnapshot[]` | 1 snapshot, ~75KB JSON | 🟡 Grows unboundedly per pipeline run |
| `status` | `"analyzed"` / `"planned"` / `"generated"` / `"delivered"` | `"analyzed"` | 🟡 Status transitions not automated |
| `qualityScore?` | `object` | Present (total: 83) | ✅ Schema exists, data written |

### Entity: MemoryIndex

| Field | Value | Risk |
|-------|-------|------|
| `version` | 1 | ✅ |
| `totalClients` | 1 | ✅ |
| `totalProjects` | 1 | ✅ |
| `industryCoverage` | 11 categories | 🔴 SubCategories data loss bug (see §5) |

---

## 3. Read / Write Flow

### Read Flow (Orchestrator Start)

```
executeBrandBrainPipeline(clientInfo, projectId)
    │
    ├── memory = getMemoryAdapter()
    │
    ├── existingClient = memory.findClientByCompany(companyName)
    │   └── reads entire clients.json → Array.find()
    │
    ├── existingProject = memory.getProject(projectId)
    │   └── reads entire projects.json → Array.find()
    │
    └── If read fails → console.warn() → continues (degraded mode)
```

**Characteristics:**
- Reads happen at pipeline start, before any agent executes
- Used only for historical context (logged, not enforced)
- Failure is non-blocking (graceful degradation)

### Write Flow (Orchestrator End)

```
After pipeline completes successfully (brandProfile exists):
    │
    ├── Build ClientMemory object
    │   ├── clientId = companyName.replace(...)
    │   ├── merge projectIds (if existing client)
    │   ├── include latestMascotProfile
    │   └── save to clients.json (full rewrite)
    │
    ├── Build BrainResultSnapshot
    │   ├── timestamp, brandProfile, packageRecommendation,
    │   │   modulePlan, mascotProfile, designDirection,
    │   │   assetGuardResult, generatedUrls, businessProfile
    │   └── ALL fields are "any" — no type enforcement
    │
    ├── Build ProjectMemory
    │   ├── merge brainResults (append snapshot to history)
    │   └── save to projects.json (full rewrite)
    │
    └── updateIndex()
        └── full rewrite of index.json
```

**Characteristics:**
- Only writes on success (pipeline completed + brandProfile exists)
- Full-file rewrite pattern — reads entire file, modifies, writes entire file
- No partial writes or transactional guarantees

### Flow Diagram

```
┌─────────────────────┐
│  Pipeline Start     │
│                     │
│  READ clients.json  │──── if fail ──▶ warn, continue
│  READ projects.json │──── if fail ──▶ warn, continue
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Agent Pipeline     │
│  (6 agents)         │
└─────────┬───────────┘
          │
          ▼
    ┌──── success? ────┐
    │                  │
    ▼                  ▼
┌──────────┐   ┌──────────────┐
│ WRITE    │   │   Skip       │
│ clients  │   │   (no-op)    │
│ .json    │   └──────────────┘
│ projects │
│ .json    │
│ index    │
│ .json    │
└──────────┘
```

---

## 4. Lifecycle Assessment

### Data Creation

| Entity | Trigger | Creator | First Write |
|--------|---------|---------|-------------|
| ClientMemory | First brand analysis | Orchestrator | After first successful pipeline |
| ProjectMemory | First brand analysis | Orchestrator | After first successful pipeline |
| BrainResultSnapshot | Each pipeline run | Orchestrator | Appended per successful run |
| IndustryMemory | System initialization | `initializeMemorySystem()` | At first `/api/brand/analyze` call |
| MemoryIndex | On any memory write | `updateIndex()` | After each saveClient/saveProject/saveIndustry |

### Data Update

| Entity | Update Strategy | Frequency |
|--------|----------------|-----------|
| ClientMemory | Merge: retains `projectIds`, updates `latestBrainResultId`, `latestMascotProfile` | Per successful pipeline run |
| ProjectMemory | Append: new `BrainResultSnapshot` pushed to `brainResults[]` | Per successful pipeline run |
| IndustryMemory | **Never updated after initialization** | Never |
| MemoryIndex | Full recalculate on every write | Per write |

### Data Deletion

| Entity | Deletion Strategy | Current Capability |
|--------|------------------|--------------------|
| ClientMemory | ❌ None | No delete method in MemoryAdapter |
| ProjectMemory | ❌ None | No delete method in MemoryAdapter |
| IndustryMemory | ❌ None | No delete method in MemoryAdapter |
| MemoryIndex | ❌ None | Recalculated on write, but not deletable |

### Data Expiration

| Entity | TTL | Max Size | Eviction |
|--------|-----|----------|----------|
| All | ❌ None | ❌ Unbounded | ❌ None |

**Finding**: Memory has unlimited growth. Each pipeline run appends to `brainResults[]`. No mechanism limits accumulation. For a high-volume system, `projects.json` would grow linearly with project count × pipeline runs.

---

## 5. Risk Assessment

### 🔴 High Risks

| # | Risk | Location | Description |
|---|------|----------|-------------|
| H1 | **Vercel Read-Only Filesystem** | `json-adapter.ts: MEMORY_DIR` | `public/memory/` is NOT writable on Vercel serverless runtime. `writeFile` calls will fail silently (caught by orchestrator's try/catch → `console.warn`). The memory system provides zero value in production. |
| H2 | **Concurrent Write Race Conditions** | `json-adapter.ts: saveClient/saveProject/saveIndustry` | Full-file read → modify → write pattern is not atomic. Two concurrent requests will overwrite each other's data. Under load, data loss is guaranteed. |
| H3 | **Client ID Encoding Instability** | `orchestrator.ts: clientId = companyName.replace()` | Client IDs generated from CJK company names produce garbled strings when encoding mismatches. Different environments may produce different clientIds for the same company, breaking the "find client by company" dedup logic. |

### 🟡 Medium Risks

| # | Risk | Location | Description |
|---|------|----------|-------------|
| M1 | **Massive Data Duplication in Snapshot** | `orchestrator.ts` write block | Each `BrainResultSnapshot` stores the ENTIRE `modulePlan` (including full brandProfile, industryProfile, all 15 modules, pagePlan, summary, resourceEstimate). Single snapshot ~75KB. After 50 pipeline runs for one project, projects.json grows ~3.75MB. The `modulePlan` data is 90% redundant across snapshots. |
| M2 | **MemoryIndex SubCategory Data Loss** | `json-adapter.ts: updateIndex()` | The `subCategories` field in `industryCoverage` is overwritten per category, not accumulated. Since industries.json has multiple entries per category with different subCategories, only the last entry's subCategory survives. E.g., `food_beverage` has `beverage, coconut_water, restaurant, hotpot` but index shows only `[hotpot]`. |
| M3 | **Industry Memory Never Accumulates** | `memory/index.ts: initializeMemorySystem()` + orchestrator | Industry knowledge is pre-loaded once and never updated. `projectCount` stays 0. `confidence` stays 0.8. `source` stays `"initial_knowledge"`. The memory system learns nothing about industries from actual projects. |
| M4 | **`any` Types in Snapshot Fields** | `memory/types.ts: BrainResultSnapshot` | All fields in BrainResultSnapshot are typed as `any` (brandProfile, modulePlan, mascotProfile, etc.). Schema evolution is impossible — no version field, no migration path. |
| M5 | **Quality Score Written but Not Triggered** | Orchestrator + `manual-quality-score.ts` | The test project has a `qualityScore` (83) in its ProjectMemory, but the orchestrator never calls `manual-quality-score.ts`. The existing score was manually injected. Quality assessment is not part of any automated flow. |

### 🟢 Low Risks

| # | Risk | Location | Description |
|---|------|----------|-------------|
| L1 | **Full-File Read for Single Record** | All `getClient`/`getProject` methods | Reading one client requires parsing the entire `clients.json`. O(n) per lookup. Fine for <100 records, degrades for thousands. |
| L2 | **No Memory Index Cross-Check** | Orchestrator | Orchestrator reads clients/projects individually but never validates against index. Index stats could drift from actual data without detection. |
| L3 | **`latestMascotProfile` Not Populated** | `orchestrator.ts` write block | `ClientMemory.latestMascotProfile` is set from `context.mascotProfile` but in test data it's `undefined`. Either the field wasn't populated or the test project's Mascot Designer returned null. |
| L4 | **No Memory Data Seeding** | `public/memory/` | No seed data script exists. If `public/memory/` is cleared, memory starts empty. Industries are re-initialized on first API call (if empty), but client/project data is lost permanently. |
| L5 | **Billing subdirectory not referenced** | `public/memory/billing/` | Empty directory exists in the memory path. No code references it. Dead artifact. |

---

## 6. Runtime Environment Risk (Vercel / Production)

| Concern | Current | Production Impact |
|---------|---------|-------------------|
| Filesystem writable | ✅ Yes (local dev) | ❌ No (Vercel serverless = read-only) |
| Concurrent requests | ❌ No load (dev) | ❌ Race conditions guaranteed |
| Data persistence | ❌ Ephemeral | ❌ New instance = new filesystem |
| File size growth | ✅ Small (1 project) | ❌ Unbounded (thousands of projects) |

**Verdict**: The current JSON file-based memory system is **development-only**. It provides zero memory functionality in a production deployment on Vercel. All memory writes would fail silently, and the orchestrator would degrade gracefully but memory would never persist.

---

## 7. Memory Governance Gap List

| # | Gap | Priority | Description | Recommended Action |
|---|-----|----------|-------------|-------------------|
| G1 | **No production storage backend** | P0 | JSON files don't work on Vercel | Swap `JsonMemoryAdapter` for a real adapter (Supabase, SQLite via better-sqlite3, or server-side JSON with API) |
| G2 | **No concurrent write safety** | P0 | Race conditions under load | Use atomic writes, file locking, or switch to DB adapter |
| G3 | **Client ID encoding** | P1 | CJK names produce unstable IDs | Use hash-based clientId (e.g., `hash(companyName)` or UUID) |
| G4 | **Snapshot data duplication** | P1 | Each snapshot duplicates 90% of modulePlan data | Store incremental diffs or reference previous snapshot ID |
| G5 | **No Industry Memory accumulation** | P2 | Industry knowledge never learns | Add accumulation flow: after project completion, update industry `projectCount`, `confidence`, `source` |
| G6 | **MemoryIndex subCategory accumulation** | P2 | Loses sub-category data | Fix `updateIndex()` to merge subCategories, not overwrite |
| G7 | **No data expiration/eviction** | P2 | Unbounded growth | Add `maxSnapshotsPerProject` (default 10), archive old brainResults |
| G8 | **Quality Score not triggered** | P2 | Written manually in test data | Add `manual-quality-score.ts` call in orchestrator post-pipeline (Note: blocked by Generation Layer freeze) |
| G9 | **No seed/restore mechanism** | P3 | No backup, no restore | Add seed script + export/import CLI |
| G10 | **`any` types in snapshot** | P3 | Schema evolution impossible | Version BrainResultSnapshot, type all fields |

---

## 8. Recommended Memory Governance V1 Scope

### Must Have (P0 — Memory operates in production)

1. **Storage adapter swap** — Replace `JsonMemoryAdapter` with a production-compatible adapter. Recommend Supabase (PostgreSQL) since Supabase setup already exists (`supabase-setup.sql`, `lib/supabase.ts`, `lib/supabase-service.ts`).
2. **Atomic writes** — Database transactions instead of file read-modify-write.

### Should Have (P1 — Data integrity)

3. **Stable client ID** — Hash-based or UUID-based client identification.
4. **Snapshot deduplication** — Store only changed fields; reference previous snapshot ID for unchanged data.
5. **Quality Score integration** — Unblock after Generation Layer governance review.

### Nice to Have (P2 — Learning & maintenance)

6. **Industry accumulation** — Update industry metrics from real project data.
7. **Expiration policy** — Max 10 snapshots per project; archive old ones.
8. **MemoryIndex fix** — Proper subCategory accumulation.

### Out of Scope (V1)

- AI-driven memory (e.g., auto-summarize past projects)
- Cross-client learning (e.g., "similar brands in your industry chose...")
- Vector search / semantic memory
- Case Memory / Anti-Pattern Memory (these are separate Knowledge Layer entities)

### Governance Rules to Enforce

```
Rule M1: Memory First
  Every pipeline must read memory before agents execute.
  Every successful pipeline must write memory after agents complete.

Rule M2: Stable Identity
  Client identity must be deterministic across environments.
  Use hash-based clientId, not raw company name.

Rule M3: Production Compatibility
  Memory storage must work on readonly filesystem.
  JSON adapter is for development only.

Rule M4: Write Safety
  Concurrent writes must not corrupt data.
  Database adapter required for production.

Rule M5: Bounded Growth
  Each project retains max N brain result snapshots.
  Default N = 10, configurable.
```

---

## 9. Summary

### Current State

```
Memory System V1 (JSON file-based)
├── ✅ Functional for local development
├── ✅ Clean 3-entity data model (Client, Industry, Project)
├── ✅ Singleton adapter, centralized in Orchestrator
├── ⚠️ 3 high risks (production filesystem, race conditions, encoding)
├── ⚠️ 5 medium risks (duplication, subCategory loss, no accumulation, any types, quality gate)
└── ❌ Zero value in production (Vercel deployment)
```

### Key Finding

The Memory System V1 has a **sound architecture pattern** (centralized in Orchestrator, agents remain stateless) but the **JSON file implementation is development-only**. The storage adapter is the correct abstraction point — swap the adapter, and the entire memory system becomes production-ready.

### Transition Path

```
Current:  JsonMemoryAdapter → public/memory/*.json
           |
           ▼
Phase 1:  (Governance V1) → Adapter swap to Supabase/PostgreSQL
           |
           ▼
Phase 2:  (Governance V2+) → Industry accumulation + data eviction
           |
           ▼
Future:   Cross-client learning, semantic search, Case/Anti-Pattern Memory
```

---

> **This document is a read-only analysis. No code was modified.**
> **All findings are based on the state of the codebase and memory data at time of discovery.**
> **Ready for Memory Governance Review.**
