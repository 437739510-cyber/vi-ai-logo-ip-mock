export const dynamic = "force-dynamic";
// API Route: /api/admin/settlements
//   GET  — 管理员查看全量结算流水（可 ?status=pending|paid、?studentId=）
//   POST — 管理员动作：{action:"markPaid", settlementId} 待结算→已到账；
//          {action:"sync"} 为已确认内容回填待结算流水。
// 真实打款由管理员在后台确认，本接口只记录打款状态，不代表真实转账。
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import {
  listAllSettlements,
  markSettlementPaid,
  syncSettlementsForConfirmedContents,
  SettlementError,
} from "@/lib/student-settlement";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可查看结算流水" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const status = statusParam && ["pending", "paid"].includes(statusParam) ? (statusParam as "pending" | "paid") : undefined;
    const studentId = searchParams.get("studentId") || undefined;

    const records = await listAllSettlements(supabaseAdmin, {
      ...(status ? { status } : {}),
      ...(studentId ? { studentId } : {}),
    });
    return NextResponse.json({ success: true, records });
  } catch (err: any) {
    if (err instanceof SettlementError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[admin/settlements] Error:", err);
    return NextResponse.json({ success: false, error: "查询失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (session?.role !== "admin") {
      return NextResponse.json({ success: false, error: "仅管理员可操作结算流水" }, { status: 403 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "markPaid") {
      const { settlementId } = body;
      if (!settlementId) {
        return NextResponse.json({ success: false, error: "缺少 settlementId" }, { status: 400 });
      }
      const record = await markSettlementPaid(supabaseAdmin, settlementId, session.userId);
      return NextResponse.json({ success: true, record });
    }

    if (action === "sync") {
      const result = await syncSettlementsForConfirmedContents(supabaseAdmin);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: "不支持的 action" }, { status: 400 });
  } catch (err: any) {
    if (err instanceof SettlementError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error("[admin/settlements] Error:", err);
    return NextResponse.json({ success: false, error: "操作失败" }, { status: 500 });
  }
}
