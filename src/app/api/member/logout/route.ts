import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("member_token")?.value;

    if (token) {
      // 删除session
      await supabaseAdmin
        .from("member_sessions")
        .delete()
        .eq("token", token);
    }

    // 清除cookie
    cookieStore.delete("member_token");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[member/logout] Error:", err);
    return NextResponse.json({ success: false, error: "退出失败" }, { status: 500 });
  }
}
