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
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("member_sessions")
      .select("member_id, expires_at")
      .eq("token", token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });
    }

    // 检查过期
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "session过期" }, { status: 401 });
    }

    // 获取member信息
    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id, phone, name, quota_used, quota_total, plan")
      .eq("id", session.member_id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 401 });
    }

    return NextResponse.json({ success: true, member });
  } catch (err: any) {
    console.error("[member/me] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
