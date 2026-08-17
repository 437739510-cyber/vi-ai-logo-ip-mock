export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import {
  buildPaymentRequiredClientInfo,
  ensurePaymentConfirmed,
  evaluatePaymentGate,
  evaluatePaymentRevocation,
} from "@/lib/core/payment-gate";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: "缺少项目ID" }, { status: 400 });
    }

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("id, status, client_info").eq("id", projectId).single();

    if (projErr || !project) {
      return NextResponse.json({ success: false, error: "项目不存在" }, { status: 404 });
    }

    const ci = project.client_info || {};
    const payment = evaluatePaymentGate(project.status, ci);
    const now = new Date().toISOString();

    if (payment.allowed) {
      const revocation = evaluatePaymentRevocation(
        project.status,
        (ci as Record<string, unknown>).generationStatus,
      );
      if (!revocation.allowed) {
        return NextResponse.json({
          success: false,
          error: "订单已进入生产阶段，禁止自动撤销付款，请人工处理",
          code: "PAYMENT_REVOCATION_REQUIRES_MANUAL_REVIEW",
        }, { status: 409 });
      }

      const { data: updatedProject, error: updateErr } = await supabaseAdmin.from("projects")
        .update({
          status: "submitted",
          client_info: buildPaymentRequiredClientInfo(ci),
          updated_at: now,
        })
        .eq("id", projectId)
        .eq("status", project.status)
        .select("id")
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (!updatedProject) {
        return NextResponse.json({ success: false, error: "订单状态已变化，请刷新后重试" }, { status: 409 });
      }
      return NextResponse.json({ success: true, status: "reverted" });
    }

    // 工单 025/077：一次 update 原子写入付款证据与本地 Worker 排队状态。
    const confirmation = evaluatePaymentRevocation(
      project.status,
      (ci as Record<string, unknown>).generationStatus,
    );
    if (!confirmation.allowed) {
      return NextResponse.json({
        success: false,
        error: "订单已存在生产记录，禁止自动补确认付款并重新排队，请人工处理",
        code: "PAYMENT_CONFIRMATION_REQUIRES_MANUAL_REVIEW",
      }, { status: 409 });
    }
    const confirmedClientInfo = ensurePaymentConfirmed(ci, now);
    const { data: updatedProject, error: updateErr } = await supabaseAdmin.from("projects")
      .update({
        status: "paid",
        client_info: {
          ...confirmedClientInfo,
          generationStatus: "pending_logo",
          generationMessage: "已确认付款，等待本地 Worker 生成",
        },
        updated_at: now,
      })
      .eq("id", projectId)
      .eq("status", project.status)
      .select("id")
      .maybeSingle();
    if (updateErr) throw updateErr;
    if (!updatedProject) {
      return NextResponse.json({ success: false, error: "订单状态已变化，请刷新后重试" }, { status: 409 });
    }

    return NextResponse.json({ success: true, status: "paid", message: "已收款，正在生成" });
  } catch (error) {
    console.error("[mark-paid] Error:", error);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
