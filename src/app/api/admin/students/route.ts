export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { logAdminOperation } from "@/lib/core/admin-operation-log";
import { hashPassword } from "@/lib/password";
import { loadCommissionConfig, loadSettlementRules, resolveTier } from "@/lib/student-settlement";

// GET: 获取大学生列表
// 提成显示口径（TICKET-127-R30）：不信任 student_accounts 存储的 level / commission_rate
// 缓存列（历史默认值可能残留 30%），改为按累计已确认单数 + site_config「commission」
// 实时计算（resolveTier），与前台合伙人页 / 结算逻辑一致。
export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("student_accounts")
    .select("id, phone, name, total_orders, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const [config, rules] = await Promise.all([
    loadCommissionConfig(supabaseAdmin),
    loadSettlementRules(supabaseAdmin),
  ]);

  const students = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const tier = resolveTier(Number(row.total_orders ?? 0) || 0, config);
    return {
      id: row.id,
      phone: row.phone,
      name: row.name,
      level: tier.level,
      total_orders: Number(row.total_orders ?? 0) || 0,
      commission_rate: tier.ratio,
      active: row.active,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ success: true, students, rules });
}

// POST: 添加大学生账号
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
    }

    const { phone, name, password } = await req.json();
    if (!phone || !name || !password) {
      return NextResponse.json({ success: false, error: "手机号、姓名、密码必填" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("student_accounts")
      .insert({ phone, name, password_hash: hashPassword(password) })
      .select("id, phone, name, level, commission_rate, active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, error: "该手机号已注册" }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    // TICKET-133-R38：新建大学生账号审计（best-effort）
    await logAdminOperation(supabaseAdmin, {
      operatorId: session.userId,
      operatorRole: session.role,
      action: "student_account_create",
      entityType: "student_accounts",
      entityIds: [data?.id ? String(data.id) : ""],
      detail: { phone, name },
    });
    return NextResponse.json({ success: true, student: data });
  } catch {
    return NextResponse.json({ success: false, error: "请求格式错误" }, { status: 400 });
  }
}
