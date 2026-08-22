export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { isClientAssigned } from "@/lib/student-assignment";

// POST: 大学生为老板生成内容
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (session?.role !== "student") {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }
    const userId = session.userId;

    const { memberId, note, platform } = await req.json();
    if (!memberId) {
      return NextResponse.json({ success: false, error: "请指定客户" }, { status: 400 });
    }

    // 越权门（GAP-C）：memberId 必须在该学生被分配的客户列表内，否则拒绝创建。
    if (!(await isClientAssigned(supabaseAdmin, userId, memberId))) {
      return NextResponse.json({ success: false, error: "无权限操作该客户（未分配）" }, { status: 403 });
    }

    // 获取大学生信息
    const { data: student } = await supabaseAdmin
      .from("student_accounts")
      .select("id, name")
      .eq("id", userId)
      .single();

    if (!student) {
      return NextResponse.json({ success: false, error: "学生账号不存在" }, { status: 404 });
    }

    // 创建内容记录 — source=student, confirmed=false
    const contentId = `student_${userId}_${Date.now()}`;
    const { data: content, error } = await supabaseAdmin
      .from("member_contents")
      .insert({
        id: contentId,
        member_id: memberId,
        images: [],
        note: note || "",
        status: "pending",
        platform: platform || "xiaohongshu",
        source: "student",
        confirmed: false,
        student_id: userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // TODO: 自动触发AI生成（调用现有generate API逻辑）
    // 先创建记录，后续由workspace页面手动触发生成

    return NextResponse.json({ success: true, content });
  } catch {
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
