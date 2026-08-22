export const dynamic = "force-dynamic";
// API Route: GET /api/admin/earnings
// 大学生「我的收入」：读取真实结算流水（非模拟数据），返回汇总 + 流水 + 等级。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import {
  currentStudentTier,
  getEarningsSummary,
  listSettlementsForStudent,
  loadSettlementRules,
  SettlementError,
} from "@/lib/student-settlement";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session?.role !== "student") {
      return NextResponse.json({ success: false, error: "仅大学生可查看收入" }, { status: 403 });
    }
    const userId = session.userId;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const status = statusParam && ["pending", "paid"].includes(statusParam) ? (statusParam as "pending" | "paid") : undefined;

    const records = await listSettlementsForStudent(supabaseAdmin, userId, status);
    const summary = getEarningsSummary(records);
    const [level, rules] = await Promise.all([
      currentStudentTier(supabaseAdmin, userId),
      loadSettlementRules(supabaseAdmin),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      records,
      level,
      rules,
    });
  } catch (err: any) {
    if (err instanceof SettlementError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[admin/earnings] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}
