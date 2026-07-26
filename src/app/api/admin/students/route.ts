export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

// GET: 获取大学生列表
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("student_accounts")
    .select("id, phone, name, level, total_orders, commission_rate, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, students: data });
}

// POST: 添加大学生账号
export async function POST(req: NextRequest) {
  try {
    const { phone, name, password } = await req.json();
    if (!phone || !name || !password) {
      return NextResponse.json({ success: false, error: "手机号、姓名、密码必填" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("student_accounts")
      .insert({ phone, name, password_hash: password })
      .select("id, phone, name, level, commission_rate, active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, error: "该手机号已注册" }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, student: data });
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}
