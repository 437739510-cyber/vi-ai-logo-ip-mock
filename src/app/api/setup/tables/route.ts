/**
 * GET /api/setup/tables — 返回建表SQL
 * 在 Supabase Dashboard SQL Editor 中执行
 */
import { NextResponse } from "next/server";

export async function GET() {
  const sql = `-- V51: DeepSeek 调用日志表
CREATE TABLE IF NOT EXISTS api_usage_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  route TEXT NOT NULL,
  method TEXT DEFAULT 'POST',
  model TEXT DEFAULT 'deepseek-chat',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_cny NUMERIC(10,6) DEFAULT 0,
  project_id TEXT,
  request_summary TEXT,
  response_status INTEGER,
  error_message TEXT,
  caller_ip TEXT
);
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON api_usage_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anon can insert" ON api_usage_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can select" ON api_usage_log FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_route ON api_usage_log(route);

-- V52: 站点配置表（定价管理等）
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on site_config" ON site_config FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anon can select site_config" ON site_config FOR SELECT USING (true);
CREATE POLICY "Anon can insert site_config" ON site_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update site_config" ON site_config FOR UPDATE USING (true);

-- 默认定价配置
INSERT INTO site_config (key, value) VALUES ('pricing', '{
  "basic": {"price": "99", "name": "基础版", "period": "一次性", "desc": "Logo方案+VI手册", "enabled": true},
  "standard": {"price": "499", "name": "标准版", "period": "一次性", "desc": "品牌故事+Logo+IP+完整VI", "enabled": true},
  "manager": {"price": "299", "name": "品牌管家", "period": "/月", "desc": "每月12条品牌化内容", "enabled": true}
}'::jsonb) ON CONFLICT (key) DO NOTHING;`;

  return NextResponse.json({ message: "在 Supabase SQL Editor 执行以下SQL", sql });
}
