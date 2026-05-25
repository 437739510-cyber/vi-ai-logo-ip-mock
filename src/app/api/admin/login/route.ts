import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("admin_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || req.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/admin",
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
