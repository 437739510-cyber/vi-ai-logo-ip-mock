export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { loadSettlementRules } from "@/lib/student-settlement";

// GET /api/admin/commission-rules
// 后台学生相关页面共用的提成阶梯实时快照：
// 复用 student-settlement 的 loadSettlementRules（site_config「commission」优先，
// partner-config 回退），保证后台显示与前台合伙人页 / 结算逻辑完全一致。
export async function GET(req: NextRequest) {
  const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  try {
    const rules = await loadSettlementRules(supabaseAdmin);
    return NextResponse.json({ success: true, rules });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "读取提成配置失败";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}