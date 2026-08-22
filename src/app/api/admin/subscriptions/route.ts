export const dynamic = "force-dynamic"
// API Route: POST /api/admin/subscriptions
// 品牌管家订阅管理（TICKET-122-R23）：管理员手工触发的订阅状态机操作。
//   activate: 按项目（projectId）激活/续费——付款审核通过后的补录/重试入口；
//   pause:    暂停客户订阅（停发即停费）；
//   resume:   恢复客户订阅。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import {
  activateSubscriptionForProject,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/brand-steward";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可操作" }, { status: 403 });
    }

    const body = await req.json();
    const { action, projectId, memberId } = body || {};

    if (action === "activate") {
      if (!projectId) {
        return NextResponse.json({ success: false, error: "缺少 projectId" }, { status: 400 });
      }
      const result = await activateSubscriptionForProject(supabaseAdmin, String(projectId), session.userId);
      return NextResponse.json({ success: true, subscription: result.subscription, memberId: result.memberId });
    }

    if (action === "pause") {
      if (!memberId) {
        return NextResponse.json({ success: false, error: "缺少 memberId" }, { status: 400 });
      }
      const subscription = await pauseSubscription(supabaseAdmin, String(memberId), session.userId);
      return NextResponse.json({ success: true, subscription });
    }

    if (action === "resume") {
      if (!memberId) {
        return NextResponse.json({ success: false, error: "缺少 memberId" }, { status: 400 });
      }
      const subscription = await resumeSubscription(supabaseAdmin, String(memberId), session.userId);
      return NextResponse.json({ success: true, subscription });
    }

    return NextResponse.json({ success: false, error: "未知操作" }, { status: 400 });
  } catch (err: any) {
    console.error("[subscriptions] Error:", err);
    const status = Number(err?.status) || 500;
    return NextResponse.json({ success: false, error: err?.message || "操作失败" }, { status });
  }
}
