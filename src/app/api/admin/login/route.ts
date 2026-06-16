import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const studentPassword = process.env.STUDENT_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    if (password === adminPassword) {
      const res = NextResponse.json({ success: true, role: "admin" });
      res.cookies.set("admin_auth", "true", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      res.cookies.set("admin_role", "admin", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      return res;
    }

    if (studentPassword && password === studentPassword) {
      const res = NextResponse.json({ success: true, role: "student" });
      res.cookies.set("admin_auth", "true", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      res.cookies.set("admin_role", "student", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
      return res;
    }

    return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
