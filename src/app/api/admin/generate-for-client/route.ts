import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";

// POST: 大学生为老板生成内容
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    const userId = cookieStore.get("admin_user_id")?.value;

    if (role !== "student" || !userId) {
      return NextResponse.json({ success: false, error: "仅大学生可操作" }, { status: 403 });
    }

    const { memberId, note, platform } = await req.json();
    if (!memberId) {
      return NextResponse.json({ success: false, error: "请指定客户" }, { status: 400 });
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
