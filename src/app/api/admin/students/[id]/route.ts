import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    const updateData: Record<string, any> = {};
    if (body.active !== undefined) updateData.active = body.active;
    if (body.name) updateData.name = body.name;
    if (body.password) updateData.password_hash = body.password;
    if (body.commission_rate !== undefined) updateData.commission_rate = body.commission_rate;
    if (body.level) updateData.level = body.level;

    const { data, error } = await supabaseAdmin
      .from("student_accounts")
      .update(updateData)
      .eq("id", id)
      .select("id, phone, name, level, total_orders, commission_rate, active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, student: data });
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("student_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
