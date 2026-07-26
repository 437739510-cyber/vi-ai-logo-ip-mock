export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();

    // 管理员登录：手机号+密码
    const adminPhone = process.env.ADMIN_PHONE || "13413049752";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (phone === adminPhone && password === adminPassword) {
      const res = NextResponse.json({ success: true, role: "admin", name: "管理员" });
      res.cookies.set("admin_auth", "true", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      res.cookies.set("admin_role", "admin", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      res.cookies.set("admin_user_id", "admin", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      return res;
    }

    // 大学生登录：查student_accounts表
    const { data: student, error } = await supabaseAdmin
      .from("student_accounts")
      .select("id, phone, password_hash, name, level, commission_rate, active")
      .eq("phone", phone)
      .single();

    if (error || !student) {
      return NextResponse.json({ success: false, error: "手机号或密码错误" }, { status: 401 });
    }

    if (!student.active) {
      return NextResponse.json({ success: false, error: "账号已停用，请联系管理员" }, { status: 403 });
    }

    if (password !== student.password_hash) {
      return NextResponse.json({ success: false, error: "手机号或密码错误" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, role: "student", name: student.name });
    res.cookies.set("admin_auth", "true", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    res.cookies.set("admin_role", "student", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    res.cookies.set("admin_user_id", student.id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}

// DELETE: 退出登录
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_auth", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  res.cookies.set("admin_role", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  res.cookies.set("admin_user_id", "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}
