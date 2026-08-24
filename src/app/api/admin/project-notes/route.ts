export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

/**
 * 项目作业台内部备注（TICKET-130-R33）
 * GET  /api/admin/project-notes?projectId=xxx  读取内部备注
 * POST /api/admin/project-notes { projectId, note }  追加内部备注
 *
 * 只追加 client_info.internalNotes，不修改项目状态机（R34 负责状态机）。
 */
async function requireAdmin(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  return session?.role === "admin" ? session : null;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ success: false, error: "缺少项目ID" }, { status: 400 });
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
  return NextResponse.json({ success: true, notes: Array.isArray(ci.internalNotes) ? ci.internalNotes : [] });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
  const { projectId, note } = (body || {}) as { projectId?: string; note?: string };
  if (!projectId || typeof note !== "string" || !note.trim()) {
    return NextResponse.json({ success: false, error: "缺少项目ID或备注内容" }, { status: 400 });
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
  const notes = Array.isArray(ci.internalNotes) ? (ci.internalNotes as any[]) : [];
  notes.push({
    id: `note_${Date.now()}_${notes.length}`,
    note: note.trim(),
    author: session.userId || "admin",
    at: new Date().toISOString(),
  });
  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ client_info: { ...ci, internalNotes: notes } })
    .eq("id", projectId);
  if (updateError) {
    console.error("[project-notes] update failed:", updateError.message);
    return NextResponse.json({ success: false, error: "保存备注失败" }, { status: 500 });
  }
  return NextResponse.json({ success: true, notes });
}
