import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.cookies.get("admin_auth")?.value;
  const role = req.cookies.get("admin_role")?.value as "admin" | "student" | undefined;

  if (auth !== "true" || !role) {
    return NextResponse.json({ success: false, role: null }, { status: 401 });
  }

  return NextResponse.json({ success: true, role });
}
