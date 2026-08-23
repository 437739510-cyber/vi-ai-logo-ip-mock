export const dynamic = "force-dynamic";
// TICKET-122-R26: 客户批量删除（软删除 + 关联保护 + 操作日志）
// 强确认在前端与服务端双重校验；任一选中客户有关联数据 => 409 整批拒绝。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { deleteClientRecords, ClientRecordsError } from "@/lib/client-records";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可删除客户" }, { status: 403 });
    }

    const body = await req.json();
    const submissionIds: unknown = body?.submissionIds;
    const confirm: unknown = body?.confirm;
    if (!Array.isArray(submissionIds)) {
      return NextResponse.json({ success: false, error: "submissionIds（非空数组）required" }, { status: 400 });
    }

    const result = await deleteClientRecords(
      supabaseAdmin,
      submissionIds as string[],
      typeof confirm === "string" ? confirm : "",
      { id: session.userId, role: session.role },
    );

    if (result.protected.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `有 ${result.protected.length} 个客户存在结算/归属/内容关联数据，已整批拒绝删除`,
          deleted: result.deleted,
          protected: result.protected,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (error: unknown) {
    if (error instanceof ClientRecordsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[admin/client-records/batch-delete] Error:", error);
    return NextResponse.json({ success: false, error: "批量删除失败" }, { status: 500 });
  }
}
