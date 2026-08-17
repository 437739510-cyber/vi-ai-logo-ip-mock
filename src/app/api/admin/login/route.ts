export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSession } from "@/lib/core/admin-session";

const LEGACY_COOKIES = ["admin_auth", "admin_role", "admin_user_id"] as const;

function clearLegacyCookies(res: NextResponse) {
  for (const name of LEGACY_COOKIES) res.cookies.set(name, "", adminSessionCookieOptions(0));
}

async function authenticatedResponse(role: "admin" | "student", userId: string, name: string) {
  const token = await createAdminSession(role, userId);
  if (!token) {
    const unavailable = NextResponse.json({ success: false, error: "后台会话配置不可用" }, { status: 503 });
    unavailable.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
    clearLegacyCookies(unavailable);
    return unavailable;
  }
  const res = NextResponse.json({ success: true, role, name });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  clearLegacyCookies(res);
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();

    // 管理员登录：手机号+密码
    const adminPhone = process.env.ADMIN_PHONE || "13413049752";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminPassword && phone === adminPhone && password === adminPassword) {
      return authenticatedResponse("admin", "admin", "管理员");
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

    return authenticatedResponse("student", student.id, student.name);
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}

// DELETE: 退出登录
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
  clearLegacyCookies(res);
  return res;
}
