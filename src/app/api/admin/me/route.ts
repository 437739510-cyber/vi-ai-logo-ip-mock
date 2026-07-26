export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function GET(req: NextRequest) {
  const auth = req.cookies.get("admin_auth")?.value;
  const role = req.cookies.get("admin_role")?.value as "admin" | "student" | undefined;
  const userId = req.cookies.get("admin_user_id")?.value;

  if (auth !== "true" || !role) {
    return NextResponse.json({ success: false, role: null }, { status: 401 });
  }

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
