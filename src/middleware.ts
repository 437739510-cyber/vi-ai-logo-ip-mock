import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";

// 管理员专属路径（大学生不可访问）
const ADMIN_ONLY_PATHS = [
  "/admin/students",
  "/admin/clients",
  "/admin/billing",
  "/admin/pricing",
  "/admin/favorites",
  "/admin/templates",
  "/admin/logo-library",
];

// 大学生专属路径（管理员也能看）
const STUDENT_PATHS = [
  "/admin/workspace",
  "/admin/earnings",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 只拦截/admin路径
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  // 未登录 → 跳登录页
  if (!session) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 大学生访问管理员专属页面 → 拦截到workspace
  if (session.role === "student" && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/admin/workspace", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path((?!login).*)"],
};
