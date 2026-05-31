// Billing Summary API — aggregates balance, today/month consumption, breakdown
import { NextResponse } from "next/server";
import { getAllAccounts } from "@/lib/billing/balance";
import { getAllLogs } from "@/lib/billing/usage-log";

export async function GET() {
  try {
    const accounts = await getAllAccounts();
    const logs = await getAllLogs();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Default account (first one) for balance
    const defaultAccount = accounts[0] || null;

    // Today's logs
    const todayLogs = logs.filter((l) => l.createdAt >= todayStart);
    const todayTotal = todayLogs.reduce((s, l) => s + l.cost, 0);

    // This month's logs
    const monthLogs = logs.filter((l) => l.createdAt >= monthStart);
    const monthTotal = monthLogs.reduce((s, l) => s + l.cost, 0);

    // Group by action for breakdown
    const actionGroups: Record<string, { label: string; cost: number; count: number; provider: string }> = {};
    const providerMap: Record<string, string> = {
      brand_analyze: "DeepSeek",
      industry_search: "DeepSeek",
      mascot_strategy: "DeepSeek",
      vi_generate: "Wanxiang",
      vi_generate_batch: "Wanxiang",
      future_ip_generate: "Wanxiang",
    };
    const actionLabels: Record<string, string> = {
      brand_analyze: "\u54c1\u724c\u5206\u6790",
      industry_search: "\u884c\u4e1a\u641c\u7d22",
      mascot_strategy: "IP \u7b56\u7565\u5206\u6790",
      vi_generate: "VI \u9875\u9762\u751f\u6210",
      vi_generate_batch: "\u6279\u91cf\u751f\u6210",
      future_ip_generate: "IP \u56fe\u7247\u751f\u6210",
    };

    for (const log of logs) {
      const key = log.action;
      if (!actionGroups[key]) {
        actionGroups[key] = {
          label: actionLabels[key] || key,
          cost: 0,
          count: 0,
          provider: providerMap[key] || "Other",
        };
      }
      actionGroups[key].cost += log.cost;
      actionGroups[key].count += 1;
    }

    // Provider-level aggregation
    const providerGroups: Record<string, { cost: number; count: number }> = {};
    for (const [action, info] of Object.entries(actionGroups)) {
      const provider = info.provider;
      if (!providerGroups[provider]) {
        providerGroups[provider] = { cost: 0, count: 0 };
      }
      providerGroups[provider].cost += info.cost;
      providerGroups[provider].count += info.count;
    }

    return NextResponse.json({
      balance: defaultAccount
        ? {
            remainingCredits: defaultAccount.remainingCredits,
            totalCredits: defaultAccount.totalCredits,
            usedCredits: defaultAccount.usedCredits,
            companyName: defaultAccount.companyName,
          }
        : null,
      today: {
        total: todayTotal,
        count: todayLogs.length,
      },
      month: {
        total: monthTotal,
        count: monthLogs.length,
      },
      breakdown: Object.entries(actionGroups)
        .map(([action, info]) => ({
          action,
          ...info,
        }))
        .sort((a, b) => b.cost - a.cost),
      providers: Object.entries(providerGroups)
        .map(([provider, info]) => ({
          provider,
          ...info,
        }))
        .sort((a, b) => b.cost - a.cost),
    });
  } catch (error) {
    console.error("Billing summary error:", error);
    return NextResponse.json(
      { error: "Failed to load billing summary" },
      { status: 500 }
    );
  }
}
