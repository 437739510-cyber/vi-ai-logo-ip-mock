export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { appendAiReviewNote, getAiReviewNotes } from "@/lib/core/project-workbench";

/**
 * 项目作业台备注（TICKET-130-R33 内部备注；TICKET-137-R40 追加 AI 档案「我的意见」）
 * GET  /api/admin/project-notes?projectId=xxx[&kind=internal|aiReview]  读取备注
 * POST /api/admin/project-notes { projectId, note, kind? }  追加备注
 *
 * kind=aiReview 时读写 client_info.aiReviewNotes（元素 { note, createdAt, operator }），
 * 其余行为与内部备注一致：只追加，不修改项目状态机（R34 负责状态机）。
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
  const kind = req.nextUrl.searchParams.get("kind") === "aiReview" ? "aiReview" : "internal";
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
  if (kind === "aiReview") {
    return NextResponse.json({ success: true, notes: getAiReviewNotes(ci) });
  }
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
  const { projectId, note, kind: rawKind } = (body || {}) as { projectId?: string; note?: string; kind?: string };
  const kind = rawKind === "aiReview" ? "aiReview" : "internal";
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
  let nextCi: Record<string, any>;
  let notes: unknown[];
  if (kind === "aiReview") {
    nextCi = { ...appendAiReviewNote(ci, note, session.userId || "admin") };
    notes = getAiReviewNotes(nextCi);
  } else {
    const internalNotes = Array.isArray(ci.internalNotes) ? (ci.internalNotes as any[]) : [];
    internalNotes.push({
      id: `note_${Date.now()}_${internalNotes.length}`,
      note: note.trim(),
      author: session.userId || "admin",
      at: new Date().toISOString(),
    });
    nextCi = { ...ci, internalNotes };
    notes = internalNotes;
  }
  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({ client_info: nextCi })
    .eq("id", projectId);
  if (updateError) {
    console.error("[project-notes] update failed:", updateError.message);
    return NextResponse.json({ success: false, error: "保存备注失败" }, { status: 500 });
  }
  return NextResponse.json({ success: true, notes });
}
