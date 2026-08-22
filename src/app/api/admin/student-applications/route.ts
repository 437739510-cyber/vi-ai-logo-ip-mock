export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import {
  listPendingApplications,
  approveApplication,
  rejectApplication,
} from "@/lib/student-application-audit";

// GET: 读取 students 表 status=pending 的申请列表（供后台审核页展示）。
export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const applications = await listPendingApplications(supabaseAdmin);
    return NextResponse.json({ success: true, applications });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "读取申请列表失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: action=approve 一键建账号并回写关联；action=reject 可填备注并回写状态。
export async function POST(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, id, note } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "缺少申请ID" }, { status: 400 });
    }

    if (action === "approve") {
      const result = await approveApplication(supabaseAdmin, id);
      return NextResponse.json({
        success: true,
        studentAccountId: result.studentAccountId,
        initialPassword: result.initialPassword,
      });
    }
    if (action === "reject") {
      await rejectApplication(supabaseAdmin, id, typeof note === "string" ? note : "");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
