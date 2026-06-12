import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || !phone.match(/^1[3-9]\d{9}$/)) {
      return NextResponse.json({ success: false, error: "手机号格式错误" }, { status: 400 });
    }

    // MVP阶段：用Supabase Auth的phone OTP
    // 注意：需要Supabase项目开启Phone Auth + 配置短信服务商(Twilio/阿里云等)
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone,
    });

    if (error) {
      // 如果Supabase未配置短信服务商，走开发模式：返回固定验证码
      console.log("[member/send-otp] Supabase OTP error:", error.message);
      // 开发模式下，验证码登录API会接受任意6位数字
      return NextResponse.json({ 
        success: true, 
        dev: true,
        message: "开发模式：输入任意6位数字即可登录" 
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[member/send-otp] Error:", err);
    return NextResponse.json({ success: false, error: "发送失败" }, { status: 500 });
  }
}
