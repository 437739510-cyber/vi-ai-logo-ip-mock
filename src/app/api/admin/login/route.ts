export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSession,
  getLoginLockStatus,
  recordLoginFailure,
  recordLoginSuccess,
  verifyAdminSession,
} from "@/lib/core/admin-session";
import { logAdminOperation } from "@/lib/core/admin-operation-log";
import { hashPassword, verifyPassword, isPasswordHash } from "@/lib/password";

const LEGACY_COOKIES = ["admin_auth", "admin_role", "admin_user_id"] as const;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function lockRemainingMessage(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "请稍后重试";
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return minutes > 0 ? `请在 ${minutes} 分 ${seconds} 秒后重试` : `请在 ${seconds} 秒后重试`;
}

function clearLegacyCookies(res: NextResponse) {
  for (const name of LEGACY_COOKIES) res.cookies.set(name, "", adminSessionCookieOptions(0));
}

async function authenticatedResponse(role: "admin" | "student", userId: string, name: string) {
  const token = await createAdminSession(role, userId);
  if (!token) {
    const unavailable = NextResponse.json({ success: false, error: "后台会话配置不可用" }, { status: 503 });
    unavailable.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
    clearLegacyCookies(unavailable);
    return unavailable;
  }
  const res = NextResponse.json({ success: true, role, name });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  clearLegacyCookies(res);
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    const account = typeof phone === "string" ? phone.trim() : "";
    const ip = clientIp(req);

    // TICKET-133-R38：登录失败限流——连续失败 >=5 次锁定 15 分钟（按账号与 IP 双向计数）。
    const lock = getLoginLockStatus(account, ip);
    if (lock.locked) {
      await logAdminOperation(supabaseAdmin, {
        operatorId: account || "unknown",
        operatorRole: "anonymous",
        action: "admin_login_failed",
        entityType: "admin_login",
        entityIds: [],
        detail: { reason: "locked", remainingSeconds: lock.remainingSeconds, ip },
      });
      return NextResponse.json(
        {
          success: false,
          error: `登录失败次数过多，账号已锁定，${lockRemainingMessage(lock.remainingSeconds)}`,
          locked: true,
          remainingSeconds: lock.remainingSeconds,
        },
        { status: 429 },
      );
    }

    const fail = async (reason: string, message: string, status: number) => {
      const state = recordLoginFailure(account, ip);
      await logAdminOperation(supabaseAdmin, {
        operatorId: account || "unknown",
        operatorRole: "anonymous",
        action: "admin_login_failed",
        entityType: "admin_login",
        entityIds: [],
        detail: { reason, failures: state.failures, ip },
      });
      return NextResponse.json(
        { success: false, error: message, ...(state.locked ? { locked: true, remainingSeconds: state.remainingSeconds } : {}) },
        { status },
      );
    };

    // 管理员登录：手机号+密码
    const adminPhone = process.env.ADMIN_PHONE || "13413049752";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminPassword && phone === adminPhone && password === adminPassword) {
      recordLoginSuccess(account, ip);
      await logAdminOperation(supabaseAdmin, {
        operatorId: "admin",
        operatorRole: "admin",
        action: "admin_login",
        entityType: "admin_login",
        entityIds: [],
        detail: { role: "admin", ip },
      });
      return authenticatedResponse("admin", "admin", "管理员");
    }

    // 大学生登录：查student_accounts表
    const { data: student, error } = await supabaseAdmin
      .from("student_accounts")
      .select("id, phone, password_hash, name, level, commission_rate, active")
      .eq("phone", phone)
      .single();

    if (error || !student) {
      return fail("wrong_password", "手机号或密码错误", 401);
    }

    if (!student.active) {
      return fail("account_disabled", "账号已停用，请联系管理员", 403);
    }

    const stored = student.password_hash;
    const isHash = isPasswordHash(stored);
    if (!verifyPassword(password, stored)) {
      return fail("wrong_password", "手机号或密码错误", 401);
    }

    // 懒迁移：旧明文账号登录成功后，立即用哈希覆盖该行，平滑无感升级
    if (!isHash) {
      await supabaseAdmin
        .from("student_accounts")
        .update({ password_hash: hashPassword(password) })
        .eq("id", student.id);
    }

    recordLoginSuccess(account, ip);
    await logAdminOperation(supabaseAdmin, {
      operatorId: student.id,
      operatorRole: "student",
      action: "admin_login",
      entityType: "admin_login",
      entityIds: [],
      detail: { role: "student", ip },
    });
    return authenticatedResponse("student", student.id, student.name);
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}

// DELETE: 退出登录（清除会话 Cookie + 记录登出审计）
export async function DELETE(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (session) {
    await logAdminOperation(supabaseAdmin, {
      operatorId: session.userId,
      operatorRole: session.role,
      action: "admin_logout",
      entityType: "admin_session",
      entityIds: [],
      detail: { ip: clientIp(req) },
    });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
  clearLegacyCookies(res);
  return res;
}
