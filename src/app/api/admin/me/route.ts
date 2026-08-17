export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ success: false, role: null }, { status: 401 });
  }

  const { role, userId } = session;
  let name = role === "admin" ? "管理员" : "";
  let commissionRate = 0;
  let level = "";

  // 大学生角色查详细信息
  if (role === "student" && userId && userId !== "admin") {
    const { data } = await supabaseAdmin
      .from("student_accounts")
      .select("name, commission_rate, level")
      .eq("id", userId)
      .single();
    if (data) {
      name = data.name;
      commissionRate = Number(data.commission_rate);
      level = data.level;
    }
  }

  return NextResponse.json({ success: true, role, userId, name, commissionRate, level });
}
