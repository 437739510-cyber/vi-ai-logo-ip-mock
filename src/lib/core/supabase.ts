// Supabase 客户端 - 服务端用 service_role，客户端用 anon
import { createClient } from "@supabase/supabase-js";

// Hardcoded for EdgeOne compatibility: NEXT_PUBLIC_* env vars are NOT available during
// EdgeOne build (no build-time env injection). These values are public and safe to commit.
// The service key (SUPABASE_SERVICE_KEY) remains a runtime env var for security.
export const SUPABASE_URL = "https://fzoscrutqhdfzwnjgjvs.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_-2xSkyp-X8u2RgLOuTg6hg_mJa1x1XG";

// 客户端用（浏览器端安全）
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 服务端用（API Route 中操作数据库）
export const supabaseAdmin = (() => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  return serviceKey
    ? createClient(SUPABASE_URL, serviceKey)
    : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
