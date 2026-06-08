# Memory Governance V1 Design

> **Memory Governance V1 — Design Document**
> Generated: 2026-05-31
> Status: Governance Design (awaiting Memory Governance Review)
> Based on: TASK-004 Memory Governance Assessment findings
>
> This document defines the governance rules, production requirements,
> and migration plan for Brand Brain Memory System V2.
>
> No code changes, no data migration, no Supabase integration.
> This is a design document only.

---

## 1. Memory Governance Principles

### Principle 1: Memory is a P0 Infrastructure Component

Memory is not a feature — it is the infrastructure that enables Brand Brain to learn across sessions. Without working memory, each pipeline run starts from zero knowledge.

### Principle 2: The Storage Adapter Pattern is Correct

The existing `MemoryAdapter` interface (`src/lib/memory/types.ts`) cleanly separates storage from business logic. The governance strategy is to **swap the adapter**, not rewrite the system.

### Principle 3: Agents Remain Stateless

Memory access is centralized in the Orchestrator. Individual agents have zero memory I/O. This pattern is correct and must be preserved in V2.

### Principle 4: Data Integrity Over Performance

Memory stores brand decisions, analysis history, and learned knowledge. These are business-critical records. Correctness (atomic writes, stable IDs, versioned schemas) takes priority over throughput.

### Principle 5: Bounded Growth

Every data entity must have a defined retention policy. Unbounded accumulation is unacceptable for production.

### Principle 6: Adaptable, Not Premature

The JSON adapter is a valid development pattern. The governance design defines the migration path without dictating the timeline.

---

## 2. MemoryAdapter V1 Production Requirements

### Requirement Matrix

| # | Requirement | Priority | Current (V1 JSON) | Target (V2 Production) |
|---|-------------|----------|-------------------|------------------------|
| R1 | Writable in production | P0 | ❌ (`public/memory/` read-only on Vercel) | ✅ Production-compatible storage |
| R2 | Atomic write per entity | P0 | ❌ (read → modify → write, race condition) | ✅ Single-operation write |
| R3 | Stable client identity | P1 | ❌ (raw companyName, encoding issues) | ✅ Deterministic, environment-independent |
| R4 | Bounded snapshot growth | P1 | ❌ (unbounded append) | ✅ Max N snapshots per project |
| R5 | Concurrent read safety | P1 | ⚠️ (full-file parse, O(n)) | ✅ Indexed lookup |
| R6 | Schema versioning | P2 | ❌ (no version field in snapshots) | ✅ Versioned snapshot schema |
| R7 | Data seeding / restore | P2 | ❌ (no seed script) | ✅ Seedable from config |
| R8 | Transactional cross-entity writes | P2 | ❌ (client + project writes not atomic) | ✅ Transaction support |

### Adapter Compatibility Rule

```
All V2 adapters MUST implement the existing MemoryAdapter interface.
No changes to orchestrator.ts or agent code are required for adapter swap.
The interface IS the governance boundary.
```

### MemoryAdapter Interface (Current — preserved for V2)

```typescript
interface MemoryAdapter {
  initialize(): Promise<void>;
  getClient(clientId: string): Promise<ClientMemory | null>;
  getAllClients(): Promise<ClientMemory[]>;
  saveClient(client: ClientMemory): Promise<void>;
  findClientByCompany(companyName: string): Promise<ClientMemory | null>;
  getIndustry(industryKey: string): Promise<IndustryMemory | null>;
  getAllIndustries(): Promise<IndustryMemory[]>;
  saveIndustry(industry: IndustryMemory): Promise<void>;
  findIndustryByCategory(category: string, subCategory?: string): Promise<IndustryMemory | null>;
  getProject(projectId: string): Promise<ProjectMemory | null>;
  getAllProjects(): Promise<ProjectMemory[]>;
  saveProject(project: ProjectMemory): Promise<void>;
  getIndex(): Promise<MemoryIndex>;
  updateIndex(): Promise<void>;
}
```

---

## 3. Storage Strategy Decision

### Decision Matrix

| Adapter | Development | Vercel Staging | Vercel Production | Concurrency | Data Persistence |
|---------|-------------|----------------|-------------------|-------------|------------------|
| **JsonMemoryAdapter** (current) | ✅ Works | ❌ Read-only FS | ❌ Read-only FS | ❌ Race condition | ⚠️ Ephemeral |
| **SupabaseMemoryAdapter** (recommended) | ✅ Works | ✅ Works | ✅ Works | ✅ Transactional | ✅ Persistent |
| **SQLite (better-sqlite3)** | ✅ Works | ⚠️ Serverless limits | ❌ No Vercel support | ✅ WAL mode | ✅ Persistent |
| **In-memory** | ✅ Works | ❌ No persistence | ❌ No persistence | ✅ | ❌ Lost on restart |

### Decision: SupabaseMemoryAdapter (Recommended)

**Rationale:**
1. Supabase project setup already exists — `supabase-setup.sql`, `src/lib/supabase.ts`, `src/lib/supabase-service.ts`
2. PostgreSQL provides atomic writes, transactions, and indexed queries
3. Vercel serverless functions can connect to Supabase via HTTPS (no persistent connection needed)
4. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars already defined in `.env.example`
5. Row-Level Security (RLS) can be used for multi-tenant data isolation

**When to keep JSON:**
- Local development (no DB setup needed)
- Integration tests (in-memory or temp file)
- CI/CD pipelines (no external dependency)

### Dual-Adapter Strategy

```
┌──────────────────────────────────────────────────────┐
│                    getMemoryAdapter()                 │
│                                                      │
│   if (NEXT_PUBLIC_USE_MOCK === "true" || !SUPABASE)  │
│       → return JsonMemoryAdapter (dev/test mode)     │
│   else                                               │
│       → return SupabaseMemoryAdapter (production)    │
└──────────────────────────────────────────────────────┘
```

This mirrors the existing `NEXT_PUBLIC_USE_MOCK` pattern already used by the frontend.

### Adapter Selection Rule (future implementation)

```
Environment variable: NEXT_PUBLIC_MEMORY_ADAPTER
  Values:
    "json"      → JsonMemoryAdapter (default for development)
    "supabase"  → SupabaseMemoryAdapter (production)
    "auto"      → Auto-detect: Supabase if env vars set, else JSON
```

---

## 4. Stable Client Identity Rule

### Current Problem

```typescript
// Current (unstable):
const clientId = companyName.replace(/[\s\/]/g, "_");
```

Problems:
1. CJK characters may be garbled by encoding mismatch (PowerShell → UTF-8)
2. Whitespace variants (`"Coca-Cola"` vs `" Coca-Cola "`) produce different IDs
3. Company name changes (legal rename) break the identity
4. Same company, different environment = different clientId

### Rule: Client Identity Must Be Deterministic

```typescript
// Recommended approach: SHA-256 hash of normalized company name
function generateClientId(companyName: string): string {
  const normalized = companyName
    .trim()
    .toLowerCase()
    .normalize("NFKC");        // Unicode normalization for CJK stability
  return "cli_" + createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 16);             // e.g., cli_a1b2c3d4e5f6g7h8
}
```

### Requirements

| # | Rule | Description |
|---|------|-------------|
| CI1 | **Hash-based** | clientId must be derived from a deterministic hash, not raw input |
| CI2 | **Environment-independent** | Same company name → same clientId on all environments |
| CI3 | **Encoding-safe** | Unicode normalization before hashing (NFKC for CJK stability) |
| CI4 | **Prefixed** | Use `cli_` prefix for human-readable identifier |
| CI5 | **Backward-compatible** | Existing `JsonMemoryAdapter` should support both old and new IDs during migration |

### Migration Rule

```
Old clients (v1 IDs):  matched by companyName field (existing lookup)
New clients (v2 IDs):  generated via hash

During migration:
  1. findClientByCompany() returns the OLD record (matched by companyName)
  2. New pipeline runs for existing clients → update old record
  3. New pipeline runs for new clients → create with new ID
  4. After all existing clients have been updated once → old IDs can be deprecated
```

---

## 5. Snapshot Governance

### Current Problem

Each `BrainResultSnapshot` stores the **entire** `modulePlan` (including full BrandProfile, all 15 modules, pagePlan, etc.). Single snapshot ~75KB. 90% of data is unchanged between runs.

### Rule: Versioned Snapshots with Deduplication

```typescript
// V2 Snapshot Schema
interface BrainResultSnapshotV2 {
  /** Schema version for migration support */
  schemaVersion: 2;

  /** Snapshot metadata */
  snapshotId: string;
  timestamp: string;
  pipelineMode: OrchestratorMode;

  /** Reference to previous snapshot for dedup */
  parentSnapshotId?: string;

  /** Changed data only (fields not present = unchanged from parent) */
  delta: {
    brandProfile?: BrandProfile;
    modulePlan?: ModulePlan;
    mascotProfile?: MascotProfile;
    designDirection?: DesignDirection;
    assetGuardResult?: AssetGuardianOutput;
    generationResult?: ManualComposerOutput;
    qualityScore?: QualityScoreResult;
    businessProfile?: BusinessProfileInput;
  };

  /** Generated URLs */
  generatedUrls: { pageId: string; label: string; url: string }[];
}
```

### Max Snapshots Per Project

```
Rule: maxSnapshotsPerProject = 10 (default, configurable)

When limit is reached:
  → Archive the oldest snapshot to a "cold storage" log
  → Remove it from active brainResults[]
  → Always keep the most recent snapshot (index 0)
```

### Snapshot Retention Policy

| Condition | Action |
|-----------|--------|
| `brainResults.length <= maxSnapshots` | Keep all |
| `brainResults.length > maxSnapshots` | Remove oldest, move to archive |
| Snapshot older than 90 days | Candidate for cold storage |
| Only qualityScore changed | Do NOT create new snapshot (update in-place) |

### Snapshot Size Target

| Metric | Current (V1) | Target (V2) |
|--------|-------------|-------------|
| Per snapshot | ~75 KB | < 5 KB (delta) |
| Full project (10 snapshots) | ~750 KB | < 50 KB + base |
| Memory per 1000 projects | ~75 MB | < 5 MB + bases |

---

## 6. Concurrency Requirements

### Current Risk

```
Request A: read clients.json    → [{id: 1}, {id: 2}]
Request B: read clients.json    → [{id: 1}, {id: 2}]
Request A: modify + write       → [{id: 1}, {id: 2}, {id: 3}]
Request B: modify + write       → [{id: 1}, {id: 2}, {id: 4}]
                                  └── {id: 3} is LOST
```

### Requirement Set

| # | Requirement | JSON Adapter | Supabase Adapter |
|---|-------------|-------------|------------------|
| C1 | Atomic single-entity write | ❌ Not possible | ✅ `INSERT/UPDATE` is atomic |
| C2 | Atomic cross-entity write (client + project) | ❌ Not possible | ✅ Database transaction |
| C3 | Read isolation | ❌ Full-file race | ✅ Row-level reads |
| C4 | Conflict detection | ❌ Last-write-wins | ✅ `updated_at` timestamp check |
| C5 | Retry mechanism | N/A | ✅ Application-level retry on conflict |

### Supabase Implementation Rule (for future)

```
All memory writes MUST use a database transaction when writing
both ClientMemory and ProjectMemory in the same pipeline run:

  supabase.rpc('begin_transaction');
  await upsertClient(client);
  await upsertProject(project, { withinTransaction: true });
  await upsertIndex(index);
  supabase.rpc('commit_transaction');
```

### JSON Adapter Concurrency Note

```
JsonMemoryAdapter is inherently unsafe for concurrent writes.
For development use only (single user).
For production → switch to SupabaseMemoryAdapter.
This is a design decision, not a bug to fix in the JSON adapter.
```

---

## 7. Runtime Environment Rules

### Environment Matrix

| Aspect | Local Dev | Vercel Preview | Vercel Production |
|--------|-----------|----------------|-------------------|
| Memory adapter | JSON (default) | JSON or Supabase | Supabase (required) |
| File writes | ✅ Writable | ❌ Read-only FS | ❌ Read-only FS |
| File reads | ✅ | ✅ | ✅ |
| Supabase connection | Optional | ✅ (if env vars set) | ✅ (required) |
| Data persistence | Ephemeral (restart = reset) | Session-level | Permanent |
| Concurrency | Single-user (safe) | Low | High |

### Environment Detection Rule

```typescript
function getMemoryAdapter(): MemoryAdapter {
  const adapterType = process.env.NEXT_PUBLIC_MEMORY_ADAPTER || "auto";

  if (adapterType === "supabase") {
    return new SupabaseMemoryAdapter();
  }

  if (adapterType === "json") {
    return new JsonMemoryAdapter();
  }

  // "auto" mode: try Supabase if env vars exist
  if (adapterType === "auto") {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return new SupabaseMemoryAdapter();
    }
    return new JsonMemoryAdapter();
  }

  return new JsonMemoryAdapter(); // safe default
}
```

### Deployment Validation Rule

```
Before deploying to production:
  ✅ NEXT_PUBLIC_MEMORY_ADAPTER must be set
  ✅ If "supabase", validate connection on startup
  ✅ Run memory write test on deploy
  ❌ If "json" → warn: "JSON adapter has no persistence in production"
```

---

## 8. Migration Plan

### Overview

```
Phase 0 (current):     JSON adapter (dev only)
Phase 1 (next):        Adapter interface decision + Supabase schema design
Phase 2 (implement):   SupabaseMemoryAdapter implementation
Phase 3 (validate):    Production validation + JSON fallback
```

### Phase 0: Keep JSON (Current)

**Status:** ✅ Active

| Task | Status | Notes |
|------|--------|-------|
| JsonMemoryAdapter | ✅ Working | Development only |
| Memory types | ✅ Defined | `ClientMemory`, `IndustryMemory`, `ProjectMemory`, `MemoryIndex` |
| Orchestrator integration | ✅ Working | Read at start, write at end |
| Industry preload | ✅ Working | 18 industries from `industry-knowledge.ts` |
| `updateIndex()` subCategory bug | ❌ Known | Documented in TASK-004 |
| ClientId encoding | ❌ Known | Documented in TASK-004 |

### Phase 1: Adapter Interface Decision + Supabase Schema

**Status:** ⏳ Design phase (this document)

| Task | Deliverable | Priority |
|------|-------------|----------|
| Define Supabase table schemas | `docs/SUPABASE_MEMORY_SCHEMA.md` | P0 |
| Define adapter selection logic | `NEXT_PUBLIC_MEMORY_ADAPTER` env var | P0 |
| Define clientId generation rule | Hash-based with NFKC normalization | P1 |
| Define snapshot max & retention | `maxSnapshotsPerProject = 10` | P1 |
| Define migration data script | Seed from existing `public/memory/*.json` | P2 |

### Phase 2: SupabaseMemoryAdapter Implementation

**Status:** ❌ Not started

| Task | Files | Dependencies |
|------|-------|-------------|
| Implement `SupabaseMemoryAdapter` | `src/lib/memory/supabase-adapter.ts` | Phase 1 schema |
| Implement `initializeMemorySystem()` for Supabase | `src/lib/memory/index.ts` update | Database tables exist |
| Update `getMemoryAdapter()` to support auto-detection | `src/lib/memory/index.ts` | Phase 1 env var |
| Add clientId v2 generation | `src/lib/memory/client-id.ts` | Phase 1 rule |
| Add snapshot retention logic | `src/lib/memory/snapshot-governance.ts` | — |
| Update orchestrator memory write | No changes needed (adapter pattern) | — |

### Phase 3: Production Validation

**Status:** ❌ Not started

| Step | Action | Success Criteria |
|------|--------|-----------------|
| 1 | Deploy SupabaseMemoryAdapter to staging | Memory writes succeed |
| 2 | Run pipeline for test project (椰岛工坊) | Verify client + project created in Supabase |
| 3 | Run second pipeline for same client | Verify client updated, project appended |
| 4 | Run two concurrent pipelines | Verify no data loss |
| 5 | Verify read-only environment (Vercel) | Memory adapter works without filesystem access |
| 6 | Rollback test | Switch `NEXT_PUBLIC_MEMORY_ADAPTER=json` → verify dev mode still works |

### Rollback Strategy

```
If SupabaseMemoryAdapter fails in production:
  → Set NEXT_PUBLIC_MEMORY_ADAPTER=json
  → Deploy (zero code change needed)
  → Memory degrades to dev mode (ephemeral, no persistence)
  → All pipeline functionality continues
```

---

## 9. Backlog

### Priority-Ordered Backlog

| # | Item | Priority | Source | Notes |
|---|------|----------|--------|-------|
| B1 | **Industry knowledge accumulation** | P2 | TASK-004 M3 | After project completion, increment industry `projectCount`, adjust `confidence`. Simple counter, not ML. |
| B2 | **MemoryIndex subCategory fix** | P2 | TASK-004 M2 | `updateIndex()` should accumulate subCategories per category, not overwrite. Pure logic fix. |
| B3 | **Quality Score integration** | P2 | TASK-004 M5 | Call `manual-quality-score.ts` after generation. Blocked by Generation Layer freeze. Unblock after Governance review. |
| B4 | **Snapshot compression** | P3 | TASK-004 M1 | Implement delta-based snapshot storage. Significant reduction in storage cost. |
| B5 | **Data seeding script** | P3 | TASK-004 L4 | CLI script to initialize memory with seed data for demo/testing. |
| B6 | **Billing subdirectory cleanup** | P3 | TASK-004 L5 | Remove empty `public/memory/billing/` directory. |
| B7 | **Memory backup/restore** | P3 | Future | Export all memory to JSON, restore from JSON. Essential before production migration. |

### Backlog Governance Rules

```
1. No backlog item may modify the Generation Layer (frozen zone)
2. No backlog item may change the MemoryAdapter interface (governance boundary)
3. Backlog items become actionable only after Phase 2 (adapter implementation) is complete
4. Priority reassessment after each governance milestone
```

---

## 10. Acceptance Criteria for Future Implementation

### P0 — Production-Capable Memory

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | Memory adapter works on Vercel read-only filesystem | Deploy to Vercel preview, run pipeline, verify data persists |
| AC2 | Two concurrent pipeline runs produce no data loss | Run 5 parallel requests, verify all clients and projects saved |
| AC3 | Memory adapter auto-detects environment | `NEXT_PUBLIC_MEMORY_ADAPTER=auto` with/without Supabase env vars |
| AC4 | Client memory survives brand analysis without context loss | `findClientByCompany()` returns all historical data |
| AC5 | Old JSON adapter still works after Supabase adapter is implemented | `NEXT_PUBLIC_MEMORY_ADAPTER=json` reads/writes `public/memory/` as before |

### P1 — Data Integrity

| # | Criterion | Verification |
|---|-----------|-------------|
| AC6 | Same company name produces same clientId on all environments | Generate clientId on local dev and Vercel, verify match |
| AC7 | Project never exceeds 10 brain result snapshots | Run pipeline 15 times, verify `brainResults.length === 10` |
| AC8 | Snapshot delta format stores <5KB when only mascotProfile changed | Compare pipeline runs with identical inputs except mascot |
| AC9 | MemoryIndex subCategories correctly accumulate all values | Verify index shows all subCategories per category |

### P2 — Maintenance

| # | Criterion | Verification |
|---|-----------|-------------|
| AC10 | Industry `projectCount` increments after each completed project | Run pipeline for 3 different projects in same industry, verify count = 3 |
| AC11 | Quality Score is written to ProjectMemory after generation | Complete generation pipeline, verify `qualityScore` populated |
| AC12 | Memory data can be exported and re-imported | JSON dump → clear → restore → verify all records intact |

### Non-Goals (V1)

```
❌ Not designing a Case Memory system
❌ Not designing an Anti-Pattern Memory system
❌ Not implementing vector/semantic search
❌ Not implementing cross-client learning
❌ Not replacing MemoryAdapter interface
❌ Not modifying orchestrator.ts
❌ Not creating new agent types
```

---

## Appendix A: Supabase Table Schema (Draft for Phase 1)

```sql
-- Client memory table
CREATE TABLE memory_clients (
  client_id      TEXT PRIMARY KEY,        -- hash-based, e.g. "cli_a1b2c3d4"
  company_name   TEXT NOT NULL,
  industry       TEXT NOT NULL,
  industry_category TEXT NOT NULL,
  has_logo       BOOLEAN DEFAULT false,
  has_mascot     BOOLEAN DEFAULT false,
  brand_stage    TEXT DEFAULT 'unknown',
  project_ids    TEXT[] DEFAULT '{}',     -- PostgreSQL array for atomic append
  project_count  INTEGER DEFAULT 0,
  metadata       JSONB DEFAULT '{}',     -- flexible fields: targetAudience, budget, etc.
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Industry memory table
CREATE TABLE memory_industries (
  industry_key      TEXT PRIMARY KEY,     -- e.g. "food_beverage/coconut_water"
  category          TEXT NOT NULL,
  sub_category      TEXT,
  design_style      TEXT[] DEFAULT '{}',
  color_tendency    TEXT[] DEFAULT '{}',
  typography_style  TEXT[] DEFAULT '{}',
  visual_keywords   TEXT[] DEFAULT '{}',
  source            TEXT DEFAULT 'initial_knowledge',
  confidence        REAL DEFAULT 0.8,
  project_count     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Project memory table
CREATE TABLE memory_projects (
  project_id    TEXT PRIMARY KEY,
  client_id     TEXT REFERENCES memory_clients(client_id),
  company_name  TEXT NOT NULL,
  status        TEXT DEFAULT 'analyzed',
  snapshots     JSONB DEFAULT '[]',      -- array of BrainResultSnapshotV2
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index table (materialized for performance)
CREATE TABLE memory_index (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  version          INTEGER DEFAULT 2,
  total_clients    INTEGER DEFAULT 0,
  total_projects   INTEGER DEFAULT 0,
  industry_coverage JSONB DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-31 | Codex (TASK-005) | Initial Memory Governance V1 Design — 10 sections covering principles, requirements, storage strategy, client identity, snapshot governance, concurrency, runtime rules, migration plan, backlog, and acceptance criteria |

---

> **This document is a governance design. No code was modified, no data was migrated, no Supabase was integrated.**
> **All 10 sections are design specifications for future implementation phases.**
> **Ready for Memory Governance Design Review.**
