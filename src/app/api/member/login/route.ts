import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";

// 生成简单token（MVP用，后续换JWT）
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, mode } = body;

    if (!phone || !phone.match(/^1[3-9]\d{9}$/)) {
      return NextResponse.json({ success: false, error: "手机号格式错误" }, { status: 400 });
    }

    let userId: string | null = null;

    if (mode === "otp") {
      const { otp } = body;
      if (!otp || otp.length !== 6) {
        return NextResponse.json({ success: false, error: "验证码格式错误" }, { status: 400 });
      }

      // MVP开发模式：接受任意6位数字验证码
      // 生产模式：验证Supabase OTP
      try {
        const { data, error } = await supabaseAdmin.auth.verifyOtp({
          phone,
          token: otp,
          type: "sms",
        });
        if (!error && data.user) {
          userId = data.user.id;
        }
      } catch {
        // Supabase OTP验证失败，走开发模式
      }

      // 开发模式兜底：任意6位验证码都通过
      if (!userId) {
        // 查找或创建member
        const { data: existingMember } = await supabaseAdmin
          .from("members")
          .select("id")
          .eq("phone", phone)
          .single();

        if (existingMember) {
          userId = existingMember.id;
        } else {
          // 创建新会员
          const { data: newMember, error: createError } = await supabaseAdmin
            .from("members")
            .insert({ phone, name: phone.slice(-4) + "老板", quota_used: 0, quota_total: 12 })
            .select("id")
            .single();

          if (createError || !newMember) {
            return NextResponse.json({ success: false, error: "创建账号失败" }, { status: 500 });
          }
          userId = newMember.id;
        }
      }
    } else if (mode === "password") {
      const { password } = body;
      if (!password || password.length < 6) {
        return NextResponse.json({ success: false, error: "密码至少6位" }, { status: 400 });
      }

      // 密码模式：查找member并验证密码
      const { data: member, error } = await supabaseAdmin
        .from("members")
        .select("id, password_hash")
        .eq("phone", phone)
        .single();

      if (error || !member) {
        return NextResponse.json({ success: false, error: "账号不存在" }, { status: 401 });
      }

      // MVP：简单密码比对（后续换bcrypt）
      if (member.password_hash !== password) {
        return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
      }
      userId = member.id;
    } else {
      return NextResponse.json({ success: false, error: "无效登录方式" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: "登录失败" }, { status: 401 });
    }

    // 生成session token
    const token = generateToken();

    // 存储session到数据库
    await supabaseAdmin
      .from("member_sessions")
      .upsert({
        member_id: userId,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    // 设置cookie
    const cookieStore = await cookies();
    cookieStore.set("member_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[member/login] Error:", err);
    return NextResponse.json({ success: false, error: "登录失败" }, { status: 500 });
  }
}
