export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import {
  getStudentAssignments,
  listAllAssignments,
  submitLead,
  claimCustomer,
  confirmAssignment,
  rejectAssignment,
  unbindAssignment,
  AssignmentError,
  type AssignmentStatus,
} from "@/lib/student-assignment";

async function requireSession(req: NextRequest) {
  return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

// GET /api/admin/student-assignments
//   student 角色：返回本人归属记录（pending + confirmed + rejected），用于工作台展示。
//   admin 角色：返回全量归属记录；可选 ?status=pending|confirmed|rejected 与 ?studentId=。
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    if (session.role === "student") {
      const records = await getStudentAssignments(supabaseAdmin, session.userId);
      return NextResponse.json({ success: true, mine: records });
    }

    const statusParam = req.nextUrl.searchParams.get("status") as AssignmentStatus | null;
    const studentId = req.nextUrl.searchParams.get("studentId") || undefined;
    const status = statusParam && ["pending", "confirmed", "rejected"].includes(statusParam) ? statusParam : undefined;
    const records = await listAllAssignments(supabaseAdmin, { status, studentId });
    return NextResponse.json({ success: true, assignments: records });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "读取归属列表失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/admin/student-assignments  （学生）
//   { action: "submitLead", phone, companyName?, clientName?, wechat?, industry? }
//   { action: "claim", phone }
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ success: false, error: "仅大学生可提交/认领" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "submitLead") {
      const result = await submitLead(supabaseAdmin, session.userId, {
        phone: typeof body.phone === "string" ? body.phone : "",
        companyName: typeof body.companyName === "string" ? body.companyName : "",
        clientName: typeof body.clientName === "string" ? body.clientName : "",
        wechat: typeof body.wechat === "string" ? body.wechat : "",
        industry: typeof body.industry === "string" ? body.industry : "",
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "claim") {
      const result = await claimCustomer(supabaseAdmin, session.userId, typeof body.phone === "string" ? body.phone : "");
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/admin/student-assignments  （管理员）
//   { action: "confirm" | "reject", studentId, projectId }
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const studentId = typeof body?.studentId === "string" ? body.studentId : "";
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    if (!studentId || !projectId) {
      return NextResponse.json({ success: false, error: "缺少 studentId/projectId" }, { status: 400 });
    }

    if (action === "confirm") {
      await confirmAssignment(supabaseAdmin, studentId, projectId);
      return NextResponse.json({ success: true });
    }
    if (action === "reject") {
      await rejectAssignment(supabaseAdmin, studentId, projectId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/student-assignments  （管理员，解除归属）
//   ?studentId=&projectId=
export async function DELETE(req: NextRequest) {
  const session = await requireSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  const studentId = req.nextUrl.searchParams.get("studentId");
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!studentId || !projectId) {
    return NextResponse.json({ success: false, error: "缺少 studentId/projectId" }, { status: 400 });
  }

  try {
    const result = await unbindAssignment(supabaseAdmin, studentId, projectId);
    return NextResponse.json({ success: true, removed: result.removed });
  } catch (error: unknown) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
