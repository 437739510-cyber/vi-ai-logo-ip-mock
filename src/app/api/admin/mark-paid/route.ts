export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function POST(req: NextRequest) {
  try {
    const auth = req.cookies.get("admin_auth")?.value;
    const role = req.cookies.get("admin_role")?.value;
    if (auth !== "true" || !role) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: "缺少项目ID" }, { status: 400 });
    }

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("*").eq("id", projectId).single();

    if (projErr || !project) {
      return NextResponse.json({ success: false, error: "项目不存在" }, { status: 404 });
    }

    if (project.status === "paid") {
      await supabaseAdmin.from("projects")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", projectId);
      return NextResponse.json({ success: true, status: "reverted" });
    }

    await supabaseAdmin.from("projects")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    // 工单 025：生产只认本地 worker——不再触发网页 analyze-brand / generate-logo。
    // 收款后确保订单进入 pending_logo 由本地 worker 轮询接管（缺失/空时补齐；
    // 已进入后续阶段的状态不倒退）。
    const ci = (project.client_info || {}) as Record<string, any>;
    if (!ci.generationStatus || ci.generationStatus === "pending_logo") {
      const nextClientInfo = { ...ci, generationStatus: "pending_logo" };
      await supabaseAdmin.from("projects")
        .update({ client_info: nextClientInfo, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    }

    return NextResponse.json({ success: true, status: "paid", message: "已收款，正在生成" });
  } catch (error) {
    console.error("[mark-paid] Error:", error);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
