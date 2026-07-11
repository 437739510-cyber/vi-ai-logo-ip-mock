-- BrandBrain Knowledge Cache Table
CREATE TABLE IF NOT EXISTS knowledge_cache (
  cache_key TEXT PRIMARY KEY,
  dimensions JSONB DEFAULT '{}'::jsonb,
  summary_cn TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  source_projects TEXT[] DEFAULT '{}',
  hit_count INT DEFAULT 1,
  confidence REAL DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE knowledge_cache IS '知识中台: 地理/历史/人文/产业/生态/政策/健康/品牌人物 八维缓存';
COMMENT ON COLUMN knowledge_cache.dimensions IS 'JSONB: {geography, history, culture, industry, ecology, policy, health, brandStory}';
