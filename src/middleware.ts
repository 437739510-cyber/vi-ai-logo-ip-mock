import { NextRequest, NextResponse } from "next/server";

// 管理员专属路径（大学生不可访问）
const ADMIN_ONLY_PATHS = [
  "/admin/students",
  "/admin/clients",
  "/admin/billing",
  "/admin/pricing",
  "/admin/favorites",
  "/admin/templates",
];

// 大学生专属路径（管理员也能看）
const STUDENT_PATHS = [
  "/admin/workspace",
  "/admin/earnings",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 只拦截/admin路径
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }

  const auth = req.cookies.get("admin_auth")?.value;
  const role = req.cookies.get("admin_role")?.value;

  // 未登录 → 跳登录页
  if (auth !== "true" || !role) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 大学生访问管理员专属页面 → 拦截到workspace
  if (role === "student" && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/admin/workspace", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path((?!login).*)"],
};
