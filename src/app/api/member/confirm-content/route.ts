import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { data: session } = await supabaseAdmin
      .from("member_sessions")
      .select("member_id")
      .eq("token", token)
      .single();

    if (!session) {
      return NextResponse.json({ success: false, error: "session无效" }, { status: 401 });
    }

    const { contentId, confirmed } = await req.json();
    if (!contentId || confirmed === undefined) {
      return NextResponse.json({ success: false, error: "参数缺失" }, { status: 400 });
    }

    if (confirmed) {
      // 确认内容
      const { error } = await supabaseAdmin
        .from("member_contents")
        .update({ confirmed: true, status: "ready" })
        .eq("id", contentId)
        .eq("member_id", session.member_id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      // 拒绝内容 — 标记为confirmed但状态回退
      const { error } = await supabaseAdmin
        .from("member_contents")
        .update({ confirmed: true, status: "pending", caption: null, note: "老板不满意，请重新生成" })
        .eq("id", contentId)
        .eq("member_id", session.member_id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, confirmed });
  } catch {
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
