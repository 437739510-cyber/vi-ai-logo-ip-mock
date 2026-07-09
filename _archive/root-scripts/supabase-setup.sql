-- ============================================================
-- Supabase 数据库建表 SQL
-- 在 Supabase 控制台 → SQL Editor 中运行
-- ============================================================

-- 1. 客户提交表 (submissions)
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wechat TEXT DEFAULT '',
  email TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  budget_range TEXT DEFAULT '',
  description TEXT DEFAULT '',
  logo_assets JSONB DEFAULT '[]',
  mascot_assets JSONB DEFAULT '[]',
  reference_manual JSONB DEFAULT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 项目表 (projects)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  assigned_to TEXT DEFAULT NULL,
  brand_colors JSONB DEFAULT NULL,
  client_info JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  timeline JSONB DEFAULT '[]'
);

-- 3. AI 方案表 (ai_plans)
CREATE TABLE IF NOT EXISTS ai_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  style TEXT DEFAULT '',
  description TEXT DEFAULT '',
  colors JSONB DEFAULT '[]',
  typography JSONB DEFAULT '[]',
  preview_url TEXT DEFAULT '',
  mockup_urls JSONB DEFAULT '[]',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VI 手册表 (vi_manuals)
CREATE TABLE IF NOT EXISTS vi_manuals (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES ai_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pages JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 收藏表 (favorites)
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES ai_plans(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 员工表 (employees)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 手册页面生成记录 (manual_pages)
CREATE TABLE IF NOT EXISTS manual_pages (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, page_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_submission ON projects(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_plans_project ON ai_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_vi_manuals_project ON vi_manuals(project_id);
CREATE INDEX IF NOT EXISTS idx_favorites_plan ON favorites(plan_id);
CREATE INDEX IF NOT EXISTS idx_manual_pages_project ON manual_pages(project_id);
