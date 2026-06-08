-- ============================================================
-- Memory Governance V1 — Supabase Memory Tables
-- 
-- 4 tables for Brand Brain Memory System.
-- 
-- Run this in Supabase Dashboard → SQL Editor before starting
-- SupabaseMemoryAdapter implementation.
--
-- Migration: additive only. No changes to existing tables.
-- ============================================================

-- ============================================================
-- Table 1: memory_clients
-- Stores ClientMemory — brand identity, project history
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_clients (
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

CREATE INDEX IF NOT EXISTS idx_memory_clients_company
  ON memory_clients (company_name);

CREATE INDEX IF NOT EXISTS idx_memory_clients_industry
  ON memory_clients (industry_category);

-- ============================================================
-- Table 2: memory_industries
-- Stores IndustryMemory — pre-loaded industry knowledge
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_industries (
  industry_key       TEXT PRIMARY KEY,
  category           TEXT NOT NULL,
  sub_category       TEXT,
  design_style       TEXT[] DEFAULT '{}',
  color_tendency     TEXT[] DEFAULT '{}',
  typography_style   TEXT[] DEFAULT '{}',
  typical_modules    TEXT[] DEFAULT '{}',
  typical_page_range INTEGER[] DEFAULT '{}',
  typical_scenes     TEXT[] DEFAULT '{}',
  sample_brands      TEXT[] DEFAULT '{}',
  visual_keywords    TEXT[] DEFAULT '{}',
  source             TEXT DEFAULT 'initial_knowledge',
  confidence         REAL DEFAULT 0.8,
  project_count      INTEGER DEFAULT 0,
  reference_manual_id TEXT,
  schema_version     INTEGER DEFAULT 2,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_industries_category
  ON memory_industries (category);

-- ============================================================
-- Table 3: memory_projects
-- Stores ProjectMemory — analysis history, generation status
-- brain_results is a JSONB array of BrainResultSnapshotV2 objects
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_projects (
  project_id           TEXT PRIMARY KEY,
  client_id            TEXT REFERENCES memory_clients(client_id),
  company_name         TEXT NOT NULL,
  status               TEXT DEFAULT 'analyzed',
  brain_results        JSONB DEFAULT '[]',
  selected_package     TEXT,
  selected_modules     TEXT[] DEFAULT '{}',
  total_generated_pages INTEGER,
  client_feedback      TEXT,
  quality_score        JSONB,
  schema_version       INTEGER DEFAULT 2,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_projects_client
  ON memory_projects (client_id);

-- ============================================================
-- Table 4: memory_index
-- Single-row materialized summary for quick stats
-- Enforced by CHECK (id = 1) — only one row allowed
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_index (
  id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version           INTEGER DEFAULT 2,
  total_clients     INTEGER DEFAULT 0,
  total_projects    INTEGER DEFAULT 0,
  industry_coverage JSONB DEFAULT '{}',
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Notes for implementer:
--
-- 1. All 4 tables use TIMESTAMPTZ for timezone-aware timestamps.
--    The JavaScript side should send ISO 8601 strings.
--
-- 2. memory_projects.brain_results stores an array of snapshots.
--    Governance rule: max 10 snapshots per project.
--    Oldest entry is trimmed when limit is exceeded.
--    No delta format. No archive table. Full snapshots only.
--
-- 3. memory_index.industry_coverage is updated on every write.
--    Unlike the JSON adapter, subCategories are properly
--    accumulated (distinct values merged, not overwritten).
--
-- 4. client_id uses hash-based format: "cli_" + SHA-256(NFKC(name)).
--    Dual-lookup: try hash first, fall back to company_name.
--
-- 5. All tables have schema_version for future migration support.
-- ============================================================
