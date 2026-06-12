import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 一次性设置API：检查会员后台所需的数据表
// 访问 /api/member/setup 查看状态
export async function GET() {
  const results: string[] = [];

  // 检查members表
  const { error: testMember } = await supabaseAdmin
    .from("members")
    .select("id")
    .limit(1);
  results.push(testMember ? `members表: 不存在 ❌` : `members表: 已存在 ✅`);

  // 检查member_sessions表
  const { error: testSession } = await supabaseAdmin
    .from("member_sessions")
    .select("id")
    .limit(1);
  results.push(testSession ? `member_sessions表: 不存在 ❌` : `member_sessions表: 已存在 ✅`);

  // 检查member_contents表
  const { error: testContent } = await supabaseAdmin
    .from("member_contents")
    .select("id")
    .limit(1);
  results.push(testContent ? `member_contents表: 不存在 ❌` : `member_contents表: 已存在 ✅`);

  const allReady = !testMember && !testSession && !testContent;

  return NextResponse.json({ 
    results,
    ready: allReady,
    message: allReady 
      ? "所有数据表已就绪" 
      : "请将 supabase-member-migration.sql 的内容复制到 Supabase SQL Editor 中执行以创建数据表" 
  });
}
