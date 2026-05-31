# Memory Implementation Plan

> **Governance V3 Planning — Engineering Bridge Document**
> Generated: 2026-05-31
> Status: Planning (awaiting Implementation Readiness Review)
> Based on: MEMORY_GOVERNANCE_V1.md (TASK-005) + GOVERNANCE_V2_SUMMARY.md (TASK-006)
>
> This document converts Memory Governance V1 design into an actionable
> engineering implementation plan. No code, no database, no Supabase.

---

## 1. Scope Definition

### In Scope

| # | Item | Source | Priority |
|---|------|--------|----------|
| S1 | SupabaseMemoryAdapter implementation | MG-V1 §3 | P0 |
| S2 | Hash-based client ID generation | MG-V1 §4 | P1 |
| S3 | Snapshot delta format + max 10 per project | MG-V1 §5 | P1 |
| S4 | Adapter auto-detection (`NEXT_PUBLIC_MEMORY_ADAPTER`) | MG-V1 §7 | P0 |
| S5 | MemoryIndex subCategory accumulation fix | MG-V1 §9 (B2) | P2 |
| S6 | Quality Score integration (post-Generation freeze) | MG-V1 §9 (B3) | P2 |

### Out of Scope

```
❌ Any modification to orchestrator.ts (adapter pattern means no change needed)
❌ Any modification to agents/ (stateless principle)
❌ Any modification to MemoryAdapter interface (governance boundary)
❌ Any modification to Generation Layer (frozen zone)
❌ Any modification to public/memory/ JSON files (keep as-is for dev)
❌ Any new agent types
❌ Any feature development
❌ Operational Memory (MG-ENH-01 — future)
❌ Governance Metadata unification (MG-ENH-02 — future)
```

### Boundary Rules

```
MemoryAdapter.ts (interface)  ← DO NOT CHANGE
JsonMemoryAdapter.ts          ← DO NOT CHANGE (preserve for dev)
SupabaseMemoryAdapter.ts      ← NEW FILE (implement)
client-id.ts                  ← NEW FILE (extract from orchestrator)
snapshot-governance.ts        ← NEW FILE (extract from orchestrator)
```

---

## 2. Implementation Milestones

### Milestone Overview

```
M0: Schema Review & Approval     [1 day]
  ↓
M1: Core Adapter (CRUD)          [3 days]
  ↓
M2: Client Identity + Migration  [2 days]
  ↓
M3: Snapshot Governance          [2 days]
  ↓
M4: Integration + Validation     [2 days]
  ↓
M5: Production Rollout            [1 day]
  ↓
                               Total: ~11 working days
```

### Milestone Details

#### M0: Schema Review & Approval

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Review Supabase table schema from MG-V1 Appendix A | Reviewed + approved schema | None |
| Confirm RLS (Row-Level Security) requirements | RLS policy document | Schema approved |
| Confirm environment variable names | `NEXT_PUBLIC_MEMORY_ADAPTER` finalized | None |
| Review migration data script requirements | Migration script spec | Schema approved |

**Exit criteria:** Schema approved by Architecture Review. No outstanding design questions.

#### M1: Core Adapter — CRUD Operations

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Create `src/lib/memory/supabase-adapter.ts` | Full `MemoryAdapter` implementation against Supabase | M0 |
| Implement `initialize()` | Creates tables if not exist, seeds initial industries | — |
| Implement `getClient`, `getAllClients`, `saveClient`, `findClientByCompany` | Client CRUD | — |
| Implement `getIndustry`, `getAllIndustries`, `saveIndustry`, `findIndustryByCategory` | Industry CRUD | — |
| Implement `getProject`, `getAllProjects`, `saveProject` | Project CRUD | — |
| Implement `getIndex`, `updateIndex` | Index operations (with subCategory fix) | — |
| Implement `findClientByCompany` with hash-based lookup | Client identity resolution | M2 (partial) |

**Tech notes:**
- Use `@supabase/supabase-js` (already available — check `package.json`)
- Use `supabase.from('memory_clients').upsert()` for atomic writes
- Use JSONB for flexible fields (`metadata`, `snapshots`)
- Use `updated_at` timestamp for conflict detection

**Exit criteria:** All CRUD operations pass against a local Supabase instance (or Supabase project). Unit tests for all 12 adapter methods.

#### M2: Client Identity + Migration

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Create `src/lib/memory/client-id.ts` | Hash-based clientId generation | M1 |
| Implement `generateClientId(companyName)` | SHA-256 + NFKC + `cli_` prefix | — |
| Implement `findClientByCompany` dual-lookup | Try hash-based ID first, fall back to name match | M1 |
| Add backward compatibility test | Old clients (name-based) still resolvable | M2 |

**Tech notes:**
- Use Node.js built-in `crypto.createHash('sha256')`
- Use `String.prototype.normalize('NFKC')` before hashing
- Query: try `client_id = hash` first, then `company_name ILIKE name`

**Exit criteria:** Same company name produces same clientId on Windows (PowerShell) and Vercel (Linux). Old records from JSON adapter are still findable.

#### M3: Snapshot Governance

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Create `src/lib/memory/snapshot-governance.ts` | Snapshot management utilities | M1 |
| Implement delta snapshot format | Compare current vs. last snapshot, store only diffs | — |
| Implement `maxSnapshotsPerProject = 10` enforcement | Trim oldest snapshots on save | — |
| Implement snapshot schema versioning | `schemaVersion: 2` field | — |

**Tech notes:**
- Delta format: `{ changedField: newValue }` where missing fields = unchanged
- Always keep index 0 (most recent)
- Archived snapshots go to a separate `memory_archives` table

**Exit criteria:** 15 sequential pipeline runs for same project → only 10 snapshots retained. Each delta < 5KB when only mascotProfile changes.

#### M4: Integration + Validation

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Update `getMemoryAdapter()` in `src/lib/memory/index.ts` | Auto-detection logic | M1 |
| Add `NEXT_PUBLIC_MEMORY_ADAPTER` env var | `auto` / `json` / `supabase` | M1 |
| Run end-to-end pipeline test with Supabase adapter | Full pipeline reads/writes memory correctly | M1, M2, M3 |
| Run concurrent pipeline test | 5 parallel requests → no data loss | M1 |
| Run JSON adapter backward compatibility test | `NEXT_PUBLIC_MEMORY_ADAPTER=json` still works | M1 |

**Exit criteria:** All 12 acceptance criteria from MG-V1 §10 pass.

#### M5: Production Rollout

| Task | Deliverable | Dependencies |
|------|-------------|-------------|
| Deploy to Vercel preview with Supabase adapter | Staging validation | M4 |
| Run test project (椰岛工坊) on staging | Memory persists across deploys | — |
| Verify rollback: set `MEMORY_ADAPTER=json`, re-deploy | Zero-code rollback works | — |
| Production deploy with `MEMORY_ADAPTER=supabase` | Live | — |
| Monitor for 24 hours | No memory errors in logs | — |

**Exit criteria:** 24 hours production with zero memory errors. Rollback tested and verified.

---

## 3. Work Breakdown Structure (WBS)

### WBS Dictionary

```
1.0  SupabaseMemoryAdapter
 1.1  Create supabase-adapter.ts scaffold
 1.2  Implement client CRUD (getClient, getAllClients, saveClient, findClientByCompany)
 1.3  Implement industry CRUD (getIndustry, getAllIndustries, saveIndustry, findIndustryByCategory)
 1.4  Implement project CRUD (getProject, getAllProjects, saveProject)
 1.5  Implement index operations (getIndex, updateIndex)
 1.6  Implement initialize (table creation, industry seeding)
 1.7  Unit tests for all 12 adapter methods
 1.8  Concurrent write test

2.0  Client Identity
 2.1  Create client-id.ts
 2.2  Implement generateClientId (SHA-256 + NFKC)
 2.3  Implement dual-lookup in findClientByCompany
 2.4  Backward compatibility test (old name-based IDs)
 2.5  Cross-environment consistency test (Windows vs Linux)

3.0  Snapshot Governance
 3.1  Create snapshot-governance.ts
 3.2  Implement delta comparison logic
 3.3  Implement maxSnapshots enforcement
 3.4  Implement archive logic
 3.5  Implement schema versioning
 3.6  Performance test (15 runs, verify size & count)

4.0  Integration
 4.1  Update getMemoryAdapter() in index.ts
 4.2  Add NEXT_PUBLIC_MEMORY_ADAPTER env var
 4.3  End-to-end pipeline test with Supabase
 4.4  Concurrent pipeline test (5 parallel)
 4.5  JSON backward compatibility test
 4.6  MG-V1 §10 acceptance criteria verification

5.0  Production Rollout
 5.1  Vercel preview deploy with Supabase
 5.2  Test project validation on staging
 5.3  Rollback test
 5.4  Production deploy
 5.5  24-hour monitoring

6.0  Documentation
 6.1  Update PROJECT_HANDOVER.md with new memory status
 6.2  Update AI_CONTEXT.md with adapter selection info
 6.3  Update ARCHITECTURE_SSOT.md if adapter interface changes
 6.4  Document Supabase setup steps (README.md or docs/SETUP.md)
```

### Dependency Graph

```
1.1 ─── 1.2 ─── 1.3 ─── 1.4 ─── 1.5 ─── 1.6 ─── 1.7 ─── 1.8
                │                                        
                ├── 2.1 ─── 2.2 ─── 2.3 ─── 2.4 ─── 2.5
                │                                        
                └── 3.1 ─── 3.2 ─── 3.3 ─── 3.4 ─── 3.5 ─── 3.6
                                                    │
                                                    └── 4.1 ─── 4.2 ─── 4.3 ─── 4.4 ─── 4.5 ─── 4.6
                                                                        │
                                                                        └── 5.1 ─── 5.2 ─── 5.3 ─── 5.4 ─── 5.5
```

---

## 4. Supabase Schema Mapping

### Entity Mapping

| Memory Entity | Supabase Table | Key Strategy |
|---------------|----------------|-------------|
| ClientMemory | `memory_clients` | `client_id` TEXT PRIMARY KEY (hash-based) |
| IndustryMemory | `memory_industries` | `industry_key` TEXT PRIMARY KEY |
| ProjectMemory | `memory_projects` | `project_id` TEXT PRIMARY KEY |
| BrainResultSnapshot | `memory_snapshots` | `id` UUID PRIMARY KEY (separate table for queryability) |
| MemoryIndex | `memory_index` | Single row, `id = 1` |
| Archived snapshots | `memory_archives` | `project_id` + `snapshot_id` compound key |

### Schema Mapping (from MG-V1 Appendix A)

```sql
-- Full schema with all governance features

-- Table 1: Clients
CREATE TABLE memory_clients (
  client_id         TEXT PRIMARY KEY,
  company_name      TEXT NOT NULL,
  industry          TEXT NOT NULL,
  industry_category TEXT NOT NULL,
  sub_category      TEXT,
  brand_description TEXT,
  has_logo          BOOLEAN DEFAULT false,
  has_mascot        BOOLEAN DEFAULT false,
  brand_stage       TEXT DEFAULT 'unknown',
  budget_range      TEXT,
  target_audience   TEXT,
  project_ids       TEXT[] DEFAULT '{}',
  project_count     INTEGER DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  schema_version    INTEGER DEFAULT 2,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_company ON memory_clients USING gin (to_tsvector('simple', company_name));
CREATE INDEX idx_clients_industry ON memory_clients (industry_category);

-- Table 2: Industries
CREATE TABLE memory_industries (
  industry_key      TEXT PRIMARY KEY,
  category          TEXT NOT NULL,
  sub_category      TEXT,
  design_style      TEXT[] DEFAULT '{}',
  color_tendency    TEXT[] DEFAULT '{}',
  typography_style  TEXT[] DEFAULT '{}',
  typical_modules   TEXT[] DEFAULT '{}',
  typical_page_range INTEGER[] DEFAULT '{}',
  typical_scenes    TEXT[] DEFAULT '{}',
  sample_brands     TEXT[] DEFAULT '{}',
  visual_keywords   TEXT[] DEFAULT '{}',
  source            TEXT DEFAULT 'initial_knowledge',
  confidence        REAL DEFAULT 0.8,
  project_count     INTEGER DEFAULT 0,
  reference_manual_id TEXT,
  schema_version    INTEGER DEFAULT 2,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_industries_category ON memory_industries (category);

-- Table 3: Projects (stores snapshots as JSONB array)
CREATE TABLE memory_projects (
  project_id        TEXT PRIMARY KEY,
  client_id         TEXT REFERENCES memory_clients(client_id),
  company_name      TEXT NOT NULL,
  status            TEXT DEFAULT 'analyzed',
  snapshot_count    INTEGER DEFAULT 0,
  schema_version    INTEGER DEFAULT 2,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Table 4: Snapshots (separate table for efficient querying)
CREATE TABLE memory_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT NOT NULL REFERENCES memory_projects(project_id),
  sequence          INTEGER NOT NULL,  -- 0-based, newest = 0
  schema_version    INTEGER DEFAULT 2,
  snapshot_type     TEXT DEFAULT 'full',  -- 'full' | 'delta'
  parent_snapshot_id UUID,  -- for delta chain
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  pipeline_mode     TEXT,
  brand_profile     JSONB,
  module_plan       JSONB,
  mascot_profile    JSONB,
  design_direction  JSONB,
  asset_guard_result JSONB,
  generation_result JSONB,
  quality_score     JSONB,
  business_profile  JSONB,
  generated_urls    JSONB DEFAULT '[]',
  size_bytes        INTEGER
);

CREATE INDEX idx_snapshots_project ON memory_snapshots (project_id, sequence);

-- Table 5: Archived snapshots (for history beyond maxSnapshotsPerProject)
CREATE TABLE memory_archives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        TEXT NOT NULL,
  original_sequence INTEGER,
  archived_at       TIMESTAMPTZ DEFAULT now(),
  snapshot_data     JSONB NOT NULL
);

CREATE INDEX idx_archives_project ON memory_archives (project_id);

-- Table 6: Index (single-row materialized summary)
CREATE TABLE memory_index (
  id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version           INTEGER DEFAULT 2,
  total_clients     INTEGER DEFAULT 0,
  total_projects    INTEGER DEFAULT 0,
  total_snapshots   INTEGER DEFAULT 0,
  industry_coverage JSONB DEFAULT '{}',
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Row-Level Security (multi-tenant isolation)
ALTER TABLE memory_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_snapshots ENABLE ROW LEVEL SECURITY;

-- (RLS policies to be defined per deployment)
```

### JSON ↔ Supabase Field Mapping

| JSON Data (Current) | Supabase Column | Notes |
|---------------------|-----------------|-------|
| `ClientMemory.clientId` | `memory_clients.client_id` | Hash-based |
| `ClientMemory.companyName` | `memory_clients.company_name` | — |
| `ClientMemory.projectIds[]` | `memory_clients.project_ids` | PostgreSQL array, atomic append |
| `ClientMemory.latestMascotProfile` | `memory_clients.metadata->>'latestMascotProfile'` | JSONB flexible field |
| `ProjectMemory.brainResults[]` | `memory_snapshots` (separate table) | One row per snapshot |
| `ProjectMemory.qualityScore` | `memory_snapshots.quality_score` | Per-snapshot quality |
| `MemoryIndex.industryCoverage` | `memory_index.industry_coverage` | JSONB, properly accumulated |

---

## 5. Adapter Migration Strategy

### Strategy: Side-by-Side with Environment Flag

```
NEXT_PUBLIC_MEMORY_ADAPTER=json    → JsonMemoryAdapter (existing, untouched)
NEXT_PUBLIC_MEMORY_ADAPTER=supabase → SupabaseMemoryAdapter (new)
NEXT_PUBLIC_MEMORY_ADAPTER=auto    → Auto-detect (Supabase if env vars present, else JSON)
```

### Code Change Map

| File | Change Type | Risk |
|------|-------------|------|
| `src/lib/memory/index.ts` | Add auto-detection in `getMemoryAdapter()` | Low — no behavior change for existing consumers |
| `src/lib/memory/supabase-adapter.ts` | **New file** | Medium — new code, no regression risk |
| `src/lib/memory/client-id.ts` | **New file** | Low — pure function |
| `src/lib/memory/snapshot-governance.ts` | **New file** | Medium — snapshot logic extracted from orchestrator |
| `.env.example` | Add `NEXT_PUBLIC_MEMORY_ADAPTER` | Low |
| `.env.local` | Add `NEXT_PUBLIC_MEMORY_ADAPTER` (local) | Low |

### Zero-Impact Guarantee

```
All existing code remains unchanged:
  orchestrator.ts          ← NO change (uses getMemoryAdapter() — same interface)
  agents/*.ts              ← NO change (stateless, no memory I/O)
  lib/memory/types.ts      ← NO change (MemoryAdapter interface unchanged)
  lib/memory/json-adapter.ts ← NO change (preserved for dev mode)
  public/memory/*.json     ← NO change (JSON adapter still writes them)
```

### Rollback

```
Flag: NEXT_PUBLIC_MEMORY_ADAPTER=json
Deploy: Same codebase, no code revert needed
Result: Back to JSON adapter, memory becomes development-only
```

---

## 6. Client ID Migration Strategy

### Strategy: Dual-Lookup with Gradual Migration

```
findClientByCompany(companyName):
  1. Generate hash-based ID: clientId = generateClientId(companyName)
  2. Query: SELECT * FROM memory_clients WHERE client_id = $1
     → If found: return (migrated client)
  3. Fallback: SELECT * FROM memory_clients WHERE company_name ILIKE $1
     → If found: return (legacy client, still using old ID)
  4. Neither found: return null (new client)
```

### Migration Steps

| Step | Action | Effect |
|------|--------|--------|
| 1 | Deploy SupabaseMemoryAdapter with dual-lookup | New clients get hash-based IDs. Old clients still resolvable by name. |
| 2 | (Optional) Run data migration script | Convert legacy IDs to hash-based for existing clients. Set `client_id = hash(companyName)`. |
| 3 | After all old clients migrated | Remove fallback name-lookup (in next release). |

### Data Migration Script (Pseudocode)

```typescript
async function migrateClientIds() {
  const supabase = createSupabaseClient();
  const jsonAdapter = new JsonMemoryAdapter();

  // Read existing clients from JSON
  const jsonClients = await jsonAdapter.getAllClients();
  const industries = await jsonAdapter.getAllIndustries();
  const projects = await jsonAdapter.getAllProjects();

  // Seed industries first
  for (const industry of industries) {
    await supabase.from('memory_industries').upsert(industry, { onConflict: 'industry_key' });
  }

  // Migrate clients with new IDs
  for (const client of jsonClients) {
    const newId = generateClientId(client.companyName);
    await supabase.from('memory_clients').upsert({
      ...client,
      client_id: newId,
      project_ids: client.projectIds,
    }, { onConflict: 'client_id' });
  }

  // Migrate projects with updated client references
  for (const project of projects) {
    const client = jsonClients.find(c => c.clientId === project.clientId);
    await supabase.from('memory_projects').upsert({
      ...project,
      client_id: client ? generateClientId(client.companyName) : project.clientId,
    }, { onConflict: 'project_id' });

    // Insert snapshots
    for (let i = 0; i < project.brainResults.length; i++) {
      await supabase.from('memory_snapshots').insert({
        project_id: project.projectId,
        sequence: i,
        schema_version: 2,
        snapshot_type: 'full',
        timestamp: project.brainResults[i].timestamp,
        brand_profile: project.brainResults[i].brandProfile,
        module_plan: project.brainResults[i].modulePlan,
        // ... map all fields
      });
    }
  }
}
```

### Migration Validation

```
Before migration: JSON files have:
  1 client (椰岛工坊), 1 project (VI-20260528-NDKW), 17 industries, 1 snapshot

After migration: Supabase should have:
  1 client (client_id = cli_abc123...), 1 project, 17 industries, 1 snapshot
  
Validation:
  → findClientByCompany("椰岛工坊") returns the migrated client
  → getProject("VI-20260528-NDKW") returns the project with the snapshot
  → getAllIndustries() returns all 17 industries with correct subCategories
```

---

## 7. Snapshot Migration Strategy

### Current State

```
public/memory/projects.json
  └── brainResults[0]
       ├── timestamp
       ├── brandProfile (~2KB)
       ├── modulePlan (~70KB)   ← 90% redundant data
       ├── mascotProfile
       ├── designDirection
       ├── assetGuardResult
       ├── generatedUrls
       └── businessProfile
```

### Target State

```
Supabase: memory_snapshots table
  └── project_id = "VI-20260528-NDKW"
       ├── sequence 0: FULL snapshot (baseline)
       ├── sequence 1: DELTA snapshot (only changed fields)
       ├── sequence 2: DELTA snapshot
       └── ... max 10 per project
```

### Migration Rules

| Rule | Description |
|------|-------------|
| First snapshot per project | Always `FULL` type (baseline) |
| Subsequent snapshots | `DELTA` type (only fields that differ from parent) |
| Max snapshots | 10 per project (configurable) |
| Eviction policy | Remove oldest snapshot when limit exceeded |
| Archive policy | Evicted snapshots moved to `memory_archives` table |

### Delta Format

```typescript
// Full snapshot (baseline)
{
  snapshot_type: 'full',
  brand_profile: { ... },       // all fields
  module_plan: { ... },         // all fields
  mascot_profile: null,
  // ... all other fields set
}

// Delta snapshot (only changed)
{
  snapshot_type: 'delta',
  parent_snapshot_id: 'uuid-of-previous',
  brand_profile: null,           // unchanged → omitted
  module_plan: null,             // unchanged → omitted
  mascot_profile: { mode: 'create_new', ... },  // changed → present
  // ... omitted fields = unchanged from parent
}
```

### Delta Application Logic

```typescript
function applyDelta(base: BrainResultSnapshot, delta: BrainResultSnapshotV2): BrainResultSnapshot {
  return {
    ...base,                    // start from parent
    ...delta,                   // apply changes (only non-null fields)
    generatedUrls: delta.generatedUrls || base.generatedUrls,
  };
}
```

---

## 8. Rollback Plan

### Rollback Scenarios

| Scenario | Trigger | Action | Recovery Time |
|----------|---------|--------|---------------|
| R1: Adapter crashes on startup | Supabase connection failure | Set `NEXT_PUBLIC_MEMORY_ADAPTER=json`, re-deploy | < 5 min |
| R2: Data corruption in Supabase | Validation check fails | Restore from JSON backup, switch to JSON adapter | < 30 min |
| R3: Performance regression | Pipeline latency > 2x | Profile bottleneck, switch to JSON temporarily | < 10 min |
| R4: Schema migration error | Snapshot schema mismatch | Roll back to previous migration version | < 15 min |

### Rollback Procedure

```text
Step 1: Identify severity
  → If pipeline is broken: emergency rollback
  → If data inconsistency: staged rollback

Step 2 (Emergency): Switch adapter
  → Set NEXT_PUBLIC_MEMORY_ADAPTER=json
  → No code change needed
  → Deploy (or restart)
  → Memory degrades to dev mode (ephemeral)
  → Pipeline continues functioning

Step 3 (Staged): Restore from backup
  → Stop pipeline if running
  → Run rollback migration script
  → Verify data integrity
  → Switch adapter back to json
  → Restart pipeline

Step 4: Post-mortem
  → Log error
  → Document root cause
  → Update implementation plan
  → Re-attempt after fix
```

### Backup Strategy

| Backup Type | Frequency | Method | Retention |
|-------------|-----------|--------|-----------|
| JSON export | Before any migration | Read all files from `public/memory/` | Until migration verified |
| Supabase dump | After migration | `pg_dump` or Supabase dashboard export | 30 days |
| Production data | Daily (once live) | Supabase automated backups | 7 days |

---

## 9. Production Validation Plan

### Validation Stages

#### Stage 1: Local Development

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Adapter works locally | `NEXT_PUBLIC_MEMORY_ADAPTER=supabase` + local Supabase | All 12 adapter methods pass |
| Pipeline reads/writes | Run full pipeline for test project | Client + project created in Supabase |
| Concurrent writes | 5 parallel requests | No data loss, no errors |
| JSON backward compat | `NEXT_PUBLIC_MEMORY_ADAPTER=json` | JSON files read/written correctly |
| Client ID stability | Run on Windows + WSL | Same company → same hash |

#### Stage 2: Vercel Preview

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Adapter works on Vercel | Deploy preview with Supabase adapter | Memory writes succeed |
| No file system dependency | Verify no `public/memory/` writes | Zero fs access |
| Pipeline complete | Run test project | Memory persists after deploy |
| Rollback test | Set `MEMORY_ADAPTER=json`, re-deploy | Pipeline still works |

#### Stage 3: Production

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Deploy | Set `NEXT_PUBLIC_MEMORY_ADAPTER=supabase` | Zero errors in 24 hours |
| Data persistence | Run pipeline, wait 1 hour, verify | Same data retrievable |
| Monitoring | Check logs for memory errors | Zero memory-related errors |

### Validation Script

```typescript
// memory-validation.ts — run in each environment
async function validateMemorySystem() {
  const adapter = getMemoryAdapter();

  // 1. Initialize
  await adapter.initialize();
  console.log('✅ Initialize passed');

  // 2. Write then read client
  const testClientId = generateClientId('TestBrand');
  await adapter.saveClient({ clientId: testClientId, companyName: 'TestBrand', ... });
  const client = await adapter.getClient(testClientId);
  console.assert(client !== null, '❌ Client write/read failed');
  console.log('✅ Client CRUD passed');

  // 3. Find by company
  const found = await adapter.findClientByCompany('TestBrand');
  console.assert(found?.clientId === testClientId, '❌ findClientByCompany failed');
  console.log('✅ Client lookup passed');

  // 4. Industry preload
  const industries = await adapter.getAllIndustries();
  console.assert(industries.length >= 11, '❌ Industry preload failed');
  console.log(`✅ Industry preload passed (${industries.length} industries)`);

  // 5. Project + snapshot
  await adapter.saveProject({ projectId: 'test-proj', ... });
  const project = await adapter.getProject('test-proj');
  console.assert(project !== null, '❌ Project write/read failed');
  console.log('✅ Project CRUD passed');

  // 6. Index
  const index = await adapter.getIndex();
  console.assert(index.totalClients >= 1, '❌ Index update failed');
  console.log('✅ Index passed');

  console.log('🎉 All validation checks passed');
}
```

---

## 10. Effort Estimate

### Engineering Hours

| WBS | Task | Estimated Hours | Dependencies |
|-----|------|----------------|--------------|
| 1.1 | SupabaseMemoryAdapter scaffold | 2 | M0 |
| 1.2 | Client CRUD | 6 | 1.1 |
| 1.3 | Industry CRUD | 3 | 1.1 |
| 1.4 | Project CRUD | 4 | 1.1 |
| 1.5 | Index operations | 2 | 1.2, 1.3, 1.4 |
| 1.6 | Initialize + seeding | 3 | 1.2, 1.3, 1.4 |
| 1.7 | Unit tests | 6 | 1.2-1.6 |
| 1.8 | Concurrent write test | 2 | 1.7 |
| 2.1 | client-id.ts | 2 | — |
| 2.2 | generateClientId implementation | 2 | 2.1 |
| 2.3 | Dual-lookup in findClientByCompany | 2 | 2.2, 1.2 |
| 2.4 | Backward compatibility test | 2 | 2.3 |
| 2.5 | Cross-environment test | 1 | 2.2 |
| 3.1 | snapshot-governance.ts | 2 | — |
| 3.2 | Delta comparison logic | 4 | 3.1 |
| 3.3 | Max snapshots enforcement | 3 | 3.1 |
| 3.4 | Archive logic | 2 | 3.1 |
| 3.5 | Schema versioning | 1 | 3.1 |
| 3.6 | Performance test | 2 | 3.2, 3.3 |
| 4.1 | Update getMemoryAdapter() | 1 | 1.1 |
| 4.2 | Add env var | 0.5 | — |
| 4.3 | End-to-end pipeline test | 4 | 1.7, 2.3, 3.6 |
| 4.4 | Concurrent pipeline test | 2 | 4.3 |
| 4.5 | JSON backward compat test | 1 | 4.3 |
| 4.6 | AC verification | 2 | 4.3-4.5 |
| 5.1 | Vercel preview deploy | 1 | 4.6 |
| 5.2 | Staging validation | 2 | 5.1 |
| 5.3 | Rollback test | 1 | 5.1 |
| 5.4 | Production deploy | 1 | 5.2, 5.3 |
| 5.5 | 24-hour monitoring | 1 | 5.4 |
| 6.1 | Update PROJECT_HANDOVER.md | 1 | All |
| 6.2 | Update AI_CONTEXT.md | 0.5 | All |
| 6.3 | Update SSOT if needed | 0.5 | All |
| 6.4 | Setup documentation | 1 | 4.6 |

### Summary

| Phase | Hours | Working Days | Notes |
|-------|-------|-------------|-------|
| M0: Schema Review | 4 | 0.5 | Not included in engineering hours |
| M1: Core Adapter | 28 | 3.5 | Largest phase — all CRUD + tests |
| M2: Client Identity | 9 | 1 | Pure logic, well-defined |
| M3: Snapshot Governance | 14 | 2 | Delta logic is the only complex part |
| M4: Integration | 10.5 | 1.5 | Testing-heavy, code-light |
| M5: Production Rollout | 5 | 1 | Deployment + monitoring |
| M6: Documentation | 3 | 0.5 | Low effort |

| **Total** | **~73.5 hours** | **~10 working days** | **~2 calendar weeks** |

### Team Size Assumption

- 1 engineer (full-time) → ~2 calendar weeks
- 2 engineers (full-time) → ~1 calendar week (with parallelization: M1 + M2 can run in parallel after scaffolds)

---

## 11. Risk Register

### Risk Matrix

| # | Risk | Probability | Impact | Mitigation | Contingency |
|---|------|-------------|--------|------------|-------------|
| R01 | Supabase project connection fails on first deploy | Low | High | Test connection in preview first | Fall back to JSON adapter |
| R02 | Delta snapshot logic has edge case with null fields | Medium | Medium | Comprehensive unit tests | Use full snapshot as fallback |
| R03 | Client ID hash collision (extremely unlikely) | Very Low | High | Use full 16 chars of hash, not truncated | Add company name as secondary key |
| R04 | Performance regression: Supabase latency > JSON file read | Medium | Low | Profile before/after migration | Optimize with connection pooling |
| R05 | RLS policy blocks legitimate reads | Low | High | Test RLS in preview first | Disable RLS temporarily |
| R06 | Environment variable misconfiguration in production | Low | High | Auto-detection with safe default | json adapter auto-fallback |
| R07 | Legacy client ID migration misses records | Low | Medium | Dual-lookup during migration phase | Manual reconciliation |
| R08 | Schema migration conflicts with existing Supabase tables | Medium | Medium | Prefix all tables with `memory_` | Drop and re-create (dev only) |
| R09 | Concurrent snapshot writes exceed max limit simultaneously | Low | Medium | Use database-level constraint | Reject write, retry |
| R10 | 24-hour monitoring period misses intermittent error | Medium | Low | Add structured logging + alerting | Extend monitoring to 72 hours |

### Risk Response Strategy

```
High Probability + High Impact:  Blocking — must be resolved before production
High Probability + Low Impact:   Accept — monitor during rollout
Low Probability + High Impact:   Mitigate — have rollback plan ready
Low Probability + Low Impact:    Accept — no action needed
```

---

## 12. Exit Criteria

### Gate 1: Implementation Readiness

| # | Criterion | Verifiable By | Status |
|---|-----------|---------------|--------|
| E1 | All governance decisions from MG-V1 are documented in this plan | Document review | ✅ |
| E2 | All 12 exit criteria for implementation are defined (this section) | Document review | ✅ |
| E3 | Supabase project exists or is ready to provision | Confirmed | ⏳ (Needs access) |
| E4 | Effort estimate is within acceptable range | Approved | ✅ ~10 days |
| E5 | Rollback plan is viable | Reviewed | ✅ |
| E6 | No conflicts with frozen zones | Cross-referenced | ✅ |
| E7 | orchestrator.ts / agents / MemoryAdapter interface untouched | Confirmed | ✅ |

### Gate 2: Implementation Complete

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| E8 | SupabaseMemoryAdapter passes all CRUD unit tests | `npm test` |
| E9 | Concurrent pipeline test passes (5 parallel, no data loss) | Test script |
| E10 | Client ID hash produces same result on all environments | Cross-environment verification |
| E11 | Snapshot delta works correctly for 15 sequential runs | Performance test |
| E12 | JSON backward compatibility confirmed | `MEMORY_ADAPTER=json` test |
| E13 | Vercel preview deploy passes with Supabase adapter | Deploy + run pipeline |
| E14 | Rollback to JSON adapter tested | Verify via `MEMORY_ADAPTER=json` |
| E15 | All 4 memory data files migrated from JSON to Supabase | Data comparison |

### Gate 3: Production Ready

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| E16 | 24-hour production monitoring with zero memory errors | Log inspection |
| E17 | Test project (椰岛工坊) data retrievable from Supabase | Direct query |
| E18 | Rollback procedure verified in production | Documented + tested |
| E19 | Documentation updated (HANDOVER, AI_CONTEXT, SETUP) | Document review |

---

## Final Readiness Assessment

### Current Status

| Factor | Assessment | Notes |
|--------|------------|-------|
| **Governance foundation** | ✅ READY | MG-V1 approved, SSOT established |
| **Design decisions** | ✅ READY | All 5 memory decisions finalized |
| **Implementation plan** | ✅ READY | This document, with WBS, estimates, risks |
| **Supabase infrastructure** | ⏳ PENDING | Project exists (`supabase-setup.sql`), but needs access verification |
| **Engineering time** | ✅ AVAILABLE | ~10 working days estimated |
| **Frozen zone compliance** | ✅ CONFIRMED | No frozen zone touched |

### Final Judgment

> **READY** — to enter Memory Implementation Phase.

Subject to one precondition:

```
Precondition: Confirm Supabase project access and verify that
  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
  are configured in the Vercel environment.
```

Once that precondition is met, the implementation can proceed in the following order:

```
Week 1:  M1 (Core Adapter) + M2 (Client Identity)
Week 2:  M3 (Snapshot Governance) + M4 (Integration) + M5 (Production Rollout)
```

---

> **This document is a planning document. No code was modified, no database was created, no Supabase was integrated.**
> **Ready for Memory Implementation Readiness Review.**
