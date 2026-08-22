export const dynamic = "force-dynamic"
// API Route: POST /api/admin/publish-content
// 大学生发布：内容被客户确认（confirmed/ready）后，填写平台+链接+凭证，转入 published。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { publishContent } from "@/lib/student-publish";
import { AssignmentError } from "@/lib/student-assignment";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (session?.role !== "student") {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }
    const userId = session.userId;

    const { contentId, platform, link, proofUrl, proofNote } = await req.json();
    if (!contentId) {
      return NextResponse.json({ success: false, error: "缺少contentId" }, { status: 400 });
    }

    const updated = await publishContent(supabaseAdmin, {
      contentId,
      studentId: userId,
      platform,
      link,
      proofUrl,
      proofNote,
    });

    return NextResponse.json({ success: true, content: updated });
  } catch (err: any) {
    if (err instanceof AssignmentError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[publish-content] Error:", err);
    return NextResponse.json({ success: false, error: "发布失败" }, { status: 500 });
  }
}
