export const dynamic = "force-dynamic"
// API Route: GET /api/admin/published-contents
// 管理员查看已发布记录（平台/链接/凭证/时间/学生/客户），作为代发验收依据。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { listPublishedContents, AssignmentError } from "@/lib/student-publish";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可查看" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || undefined;
    const platform = searchParams.get("platform") || undefined;

    const records = await listPublishedContents(supabaseAdmin, {
      ...(studentId ? { studentId } : {}),
      ...(platform ? { platform } : {}),
    });

    return NextResponse.json({ success: true, records });
  } catch (err: any) {
    if (err instanceof AssignmentError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[published-contents] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
