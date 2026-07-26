// Supabase 客户端 — 懒加载 + Proxy 保持原有导出名
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://fzoscrutqhdfzwnjgjvs.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_-2xSkyp-X8u2RgLOuTg6hg_mJa1x1XG";

// 懒加载客户端：只在首次访问属性/方法时初始化
function lazyClient(url: string, key: string): SupabaseClient {
  let client: SupabaseClient | null = null;
  return new Proxy({} as SupabaseClient, {
    get(_, prop) {
      if (!client) {
        client = createClient(url, key);
      }
      const value = (client as any)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
    has(_, prop) {
      if (!client) {
        client = createClient(url, key);
      }
      return prop in client;
    },
  });
}

// 浏览器端安全
export const supabase: SupabaseClient = lazyClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 服务端用（API Route 中操作数据库）
export const supabaseAdmin: SupabaseClient = (() => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  return serviceKey
    ? lazyClient(SUPABASE_URL, serviceKey)
    : lazyClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();