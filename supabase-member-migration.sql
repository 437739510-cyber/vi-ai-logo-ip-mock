-- Brand Brain 会员后台数据表
-- 在 Supabase SQL Editor (https://supabase.com/dashboard/project/fzoscrutqhdfzwnjgjvs/sql) 中执行

-- 1. 会员表
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY DEFAULT ('mem_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 6)),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  plan TEXT DEFAULT 'free',
  quota_used INTEGER DEFAULT 0,
  quota_total INTEGER DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 会员session表
CREATE TABLE IF NOT EXISTS member_sessions (
  id BIGSERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 会员内容表
CREATE TABLE IF NOT EXISTS member_contents (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  images JSONB DEFAULT '[]',
  note TEXT DEFAULT '',
  caption TEXT,
  status TEXT DEFAULT 'pending',
  platform TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Storage bucket for member photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('member-photos', 'member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 5. 索引
CREATE INDEX IF NOT EXISTS idx_member_sessions_token ON member_sessions(token);
CREATE INDEX IF NOT EXISTS idx_member_sessions_member_id ON member_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_contents_member_id ON member_contents(member_id);

-- 6. RLS策略
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on member_sessions" ON member_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on member_contents" ON member_contents FOR ALL USING (true) WITH CHECK (true);

-- 7. Storage策略
CREATE POLICY "Public read member photos" ON storage.objects FOR SELECT USING (bucket_id = 'member-photos');
CREATE POLICY "Service role upload member photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'member-photos' AND auth.role() = 'service_role');
CREATE POLICY "Service role delete member photos" ON storage.objects FOR DELETE USING (bucket_id = 'member-photos' AND auth.role() = 'service_role');

-- 完成！
SELECT 'Member tables created successfully!' AS result;
