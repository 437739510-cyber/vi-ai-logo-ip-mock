// Supabase 客户端 - 服务端用 service_role，客户端用 anon
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// 客户端用（浏览器端安全）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 服务端用（API Route 中操作数据库）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
