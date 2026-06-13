import { NextResponse } from 'next/server';

/**
 * GET: Returns the SQL needed to create the api_usage_log table
 * Run this SQL in Supabase Dashboard > SQL Editor
 */
export async function GET() {
  return NextResponse.json({ 
    message: '在 Supabase Dashboard SQL Editor 中执行以下 SQL:',
    sql: `-- V51: DeepSeek 调用日志表
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

-- 启用 RLS
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;

-- Service role 完全访问
CREATE POLICY "Service role full access" ON api_usage_log 
  FOR ALL USING (auth.role() = 'service_role');

-- 允许匿名插入（服务端调用）
CREATE POLICY "Anon can insert" ON api_usage_log 
  FOR INSERT WITH CHECK (true);

-- 允许匿名查询（管理后台）
CREATE POLICY "Anon can select" ON api_usage_log 
  FOR SELECT USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_route ON api_usage_log(route);`
  });
}
