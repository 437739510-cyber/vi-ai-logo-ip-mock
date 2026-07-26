export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get("admin_role")?.value;
    const userId = cookieStore.get("admin_user_id")?.value;

    if (role !== "student" || !userId) {
      return NextResponse.json({ success: false, error: "仅大学生可访问" }, { status: 403 });
    }

    // 查找该大学生生成的内容（含images字段）
    const { data: contents, error } = await supabaseAdmin
      .from("member_contents")
      .select("id, member_id, caption, status, confirmed, platform, created_at, note, images")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: true, contents: [] });
    }

    // 获取关联的品牌名
    const memberIds = [...new Set((contents || []).map((c: any) => c.member_id))];
    let memberMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from("members")
        .select("id, brand_name")
        .in("id", memberIds);
      (members || []).forEach((m: any) => {
        memberMap[m.id] = m.brand_name || "未命名";
      });
    }

    const result = (contents || []).map((c: any) => ({
      ...c,
      brand_name: memberMap[c.member_id] || "未知客户",
    }));

    return NextResponse.json({ success: true, contents: result });
  } catch {
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
