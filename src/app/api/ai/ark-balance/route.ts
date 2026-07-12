/**
 * ARK Seedream Balance Query
 * GET /api/ai/ark-balance
 *
 * Volcengine ARK inference API key cannot query billing.
 * Dynamic balance: ARK_MANUAL_BALANCE (baseline) minus tracked costs since ARK_BALANCE_UPDATED_AT.
 * Update both env vars after each recharge; the system auto-decrements.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/core/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const API_KEY = process.env.ARK_API_KEY;
  const MANUAL_BALANCE = process.env.ARK_MANUAL_BALANCE;

  if (!API_KEY) {
    return NextResponse.json({
      provider: "ARK Seedream (Volcengine)",
      balance: null,
      currency: "CNY",
      status: "no_key",
    });
  }

  // Dynamic balance: baseline minus tracked costs since last update
  // Set ARK_MANUAL_BALANCE when you recharge, and ARK_BALANCE_UPDATED_AT to that moment (ISO)
  // The system auto-subtracts usage, so balance falls as you spend
  if (MANUAL_BALANCE) {
    const baseline = parseFloat(MANUAL_BALANCE);
    if (!isNaN(baseline)) {
      const updatedAt = process.env.ARK_BALANCE_UPDATED_AT;
      try {
        // Query costs since baseline was last set
        let query = supabaseAdmin
          .from("api_usage_log")
          .select("cost_cny")
          .or("model.ilike.%seedream%,model.ilike.%doubao%");
        if (updatedAt) {
          query = query.gte("created_at", updatedAt);
        }
        const { data } = await query;

        let spent = 0;
        if (data) {
          spent = data.reduce((sum, r) => sum + (r.cost_cny || 0), 0);
        }
        spent = Math.round(spent * 100) / 100;

        const estimated = Math.max(0, Math.round((baseline - spent) * 100) / 100);
        return NextResponse.json({
          provider: "ARK Seedream (Volcengine)",
          balance: estimated,
          currency: "CNY",
          status: "active",
          baseline,
          spent,
          note: updatedAt
            ? `基准余额 ¥${baseline}，自 ${new Date(updatedAt).toLocaleDateString("zh-CN")} 起消耗 ¥${spent}`
            : `基准余额 ¥${baseline}，累计消耗 ¥${spent}（未设更新时间，从全部记录扣减）`,
        });
      } catch {
        // Query failed, just show baseline
        return NextResponse.json({
          provider: "ARK Seedream (Volcengine)",
          balance: baseline,
          currency: "CNY",
          status: "active",
          note: "手动维护（消耗查询失败，显示基准余额）",
        });
      }
    }
  }

  // Fallback: no manual balance set — show tracked usage
  try {
    const { data } = await supabaseAdmin
      .from("api_usage_log")
      .select("cost_cny")
      .or("model.ilike.%seedream%,model.ilike.%doubao%");

    let totalTracked = 0;
    if (data) {
      totalTracked = data.reduce((sum, r) => sum + (r.cost_cny || 0), 0);
    }

    return NextResponse.json({
      provider: "ARK Seedream (Volcengine)",
      balance: null,
      trackedCost: Math.round(totalTracked * 100) / 100,
      currency: "CNY",
      status: "manual_check_required",
      note: "请设置 ARK_MANUAL_BALANCE + ARK_BALANCE_UPDATED_AT 环境变量，系统将自动扣减消耗显示实时余额",
    });
  } catch {
    return NextResponse.json({
      provider: "ARK Seedream (Volcengine)",
      balance: null,
      currency: "CNY",
      status: "error",
      note: "请设置ARK_MANUAL_BALANCE环境变量",
    });
  }
}
