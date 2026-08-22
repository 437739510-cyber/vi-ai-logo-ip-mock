export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { resolveLoginIdentity, PHONE_RE } from "@/lib/auth-identity";

// TICKET-122-R25：统一登录面板的身份识别接口（非登录接口，不创建会话）。
// 输入手机号，返回手机号归属：student（大学生/合伙人）/ member（商家/会员）/ none（未开通）。
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string" || !PHONE_RE.test(phone)) {
      return NextResponse.json({ success: false, error: "手机号格式错误" }, { status: 400 });
    }

    const identity = await resolveLoginIdentity(supabaseAdmin, phone);
    return NextResponse.json({ success: true, identity });
  } catch (err) {
    console.error("[auth/identity] Error:", err);
    return NextResponse.json({ success: false, error: "身份识别失败，请稍后重试" }, { status: 500 });
  }
}
