export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { logAdminOperation } from "@/lib/core/admin-operation-log";

/**
 * 项目作业台：分配负责人（TICKET-130-R33）
 * POST /api/admin/project-assign-owner { projectId, ownerName }
 *
 * 只写入 client_info.assignedTo，不修改项目状态机（R34 负责状态机）。
 */
export async function POST(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (session?.role !== "admin") {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
  const { projectId, ownerName } = (body || {}) as { projectId?: string; ownerName?: string };
  if (!projectId || typeof ownerName !== "string" || !ownerName.trim()) {
    return NextResponse.json({ success: false, error: "缺少项目ID或负责人姓名" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("client_info")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ success: false, error: "项目不存在" }, { status: 404 });
  }
  const ci = (data.client_info as Record<string, any>) || {};
  const assignedTo = {
    name: ownerName.trim(),
    assignedBy: session.userId || "admin",
    at: new Date().toISOString(),
  };
  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ client_info: { ...ci, assignedTo } })
    .eq("id", projectId);
  if (updateError) {
    console.error("[project-assign-owner] update failed:", updateError.message);
    return NextResponse.json({ success: false, error: "保存负责人失败" }, { status: 500 });
  }
  await logAdminOperation(supabaseAdmin, {
    operatorId: session.userId,
    operatorRole: session.role,
    action: "admin_assign_owner",
    entityType: "projects",
    entityIds: [projectId],
    detail: { projectId, ownerName: ownerName.trim(), assignedBy: session.userId || "admin" },
  });
  return NextResponse.json({ success: true, assignedTo });
}
