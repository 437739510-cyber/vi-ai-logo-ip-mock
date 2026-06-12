import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    // 查找session
    const { data: session } = await supabaseAdmin
      .from("member_sessions")
      .select("member_id")
      .eq("token", token)
      .single();

    if (!session) {
      return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });
    }

    // 获取member
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, quota_used, quota_total, plan")
      .eq("id", session.member_id)
      .single();

    if (!member) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });
    }

    // 获取内容列表
    const { data: contents, error } = await supabaseAdmin
      .from("member_contents")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // 表可能还没建，返回空列表
      return NextResponse.json({ success: true, contents: [], quotaUsed: member.quota_used, quotaTotal: member.quota_total, plan: member.plan || "free" });
    }

    return NextResponse.json({ 
      success: true, 
      contents: contents || [], 
      quotaUsed: member.quota_used, 
      quotaTotal: member.quota_total, 
      plan: member.plan || "free" 
    });
  } catch (err: any) {
    console.error("[member/contents] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
