export const dynamic = "force-dynamic"
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";
import { getSubscription } from "@/lib/brand-steward";

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

    // TICKET-122-R23：返回订阅状态（含周期起止），供「到期提醒」展示；订阅表未部署时静默降级。
    let subscription = null;
    try {
      subscription = await getSubscription(supabaseAdmin, member.id);
    } catch (e) {
      console.error("[member/me] 查询订阅状态失败:", e);
    }

    return NextResponse.json({ success: true, member, subscription });
  } catch (err: any) {
    console.error("[member/me] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
