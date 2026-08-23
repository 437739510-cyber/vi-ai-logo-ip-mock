export const dynamic = "force-dynamic";
// TICKET-122-R26: 客户管理列表（真实数据，管理端专用）
// submissions + 关联 projects + 关联保护标记；排除软删除记录。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { listClientRecords, ClientRecordsError } from "@/lib/client-records";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可查看客户列表" }, { status: 403 });
    }

    const clients = await listClientRecords(supabaseAdmin);
    return NextResponse.json({ success: true, clients });
  } catch (error: unknown) {
    if (error instanceof ClientRecordsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[admin/client-records] Error:", error);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
