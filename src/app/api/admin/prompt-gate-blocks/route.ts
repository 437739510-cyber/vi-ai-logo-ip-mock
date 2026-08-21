export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/core/admin-session";
import { readPromptGateBlocks, filterPromptGateBlocks, summarizePromptGateBlocks } from "@/lib/prompt-gate/admin-reader";
import { readPromptGateBlocksFromTable } from "@/lib/prompt-gate/upsert";

/**
 * TICKET-122-R11：提示词门拦截记录只读接口（本地 JSON 数据源）。
 * 查询参数：ruleId / industryFamily / status / from / to（ISO 时间）。
 * 只读展示；生产 Supabase upsert 未授权，本接口绝不写库。
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }
    const sp = req.nextUrl.searchParams;
    const filters = {
      ruleId: sp.get("ruleId") || undefined,
      industryFamily: sp.get("industryFamily") || undefined,
      status: sp.get("status") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
    };
    // TICKET-122-R14：双源可切换（PROMPT_GATE_SOURCE=local|table|both，默认 local）
    const source = process.env.PROMPT_GATE_SOURCE || "local";
    let all = await readPromptGateBlocks();
    if (source === "table" || source === "both") {
      const fromTable = await readPromptGateBlocksFromTable();
      if (source === "both") {
        const keys = new Set(fromTable.map((b) => `${b.blockedAt}|${b.ticketCode}|${b.ruleId}`));
        all = [...fromTable, ...all.filter((b) => !keys.has(`${b.blockedAt}|${b.ticketCode}|${b.ruleId}`))];
      } else {
        all = fromTable;
      }
    }
    const blocks = filterPromptGateBlocks(all, filters);
    const summary = summarizePromptGateBlocks(blocks);
    return NextResponse.json({ success: true, blocks, summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}
