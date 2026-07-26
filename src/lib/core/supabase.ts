// Supabase 客户端 - 服务端用 service_role，客户端用 anon
import { createClient } from "@supabase/supabase-js";

// During EdgeOne build, env vars are not injected into the build sandbox,
// so "supabaseUrl is required" crashes at module load time.
// We use placeholder values at build time; at runtime the server injects real env vars
// and the module is evaluated fresh per-request in serverless environments.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

// 客户端用（浏览器端安全）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端用（API Route 中操作数据库）
// 注意：不要改成模块级 createClient，否则浏览器端 import 本模块会崩溃
// 因为 SUPABASE_SERVICE_KEY 没有 NEXT_PUBLIC_ 前缀，浏览器端为 undefined
// V7c: 无service_key时fallback到anon key（开发/测试用）
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : createClient(supabaseUrl, supabaseAnonKey);
