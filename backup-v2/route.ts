/**
 * Billing Summary API V2
 * 汇总所有模型余额 + 扣子PAT Token状态
 */
import { NextResponse } from "next/server";

export async function GET() {
  const results: {
    deepseek: { balance: number | null; source: string; error?: string };
    dashscope: { availableAmount: number | null; source: string; error?: string };
    cozeToken: { expiresAt: string | null; daysLeft: number | null; isExpired: boolean; source: string };
  } = {
    deepseek: { balance: null, source: "error" },
    dashscope: { availableAmount: null, source: "error" },
    cozeToken: { expiresAt: null, daysLeft: null, isExpired: true, source: "error" },
  };

  // DeepSeek余额
  try {
    const dsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/billing/deepseek-balance`);
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      results.deepseek = { balance: dsData.balance, source: dsData.source, error: dsData.error };
    } else {
      results.deepseek.error = `HTTP ${dsRes.status}`;
    }
  } catch {
    results.deepseek.error = "请求失败";
  }

  // 通义万相余额
  try {
    const dqRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/billing/dashscope-balance`);
    if (dqRes.ok) {
      const dqData = await dqRes.json();
      results.dashscope = { availableAmount: dqData.availableAmount, source: dqData.source, error: dqData.error };
    } else {
      results.dashscope.error = `HTTP ${dqRes.status}`;
    }
  } catch {
    results.dashscope.error = "请求失败";
  }

  // 扣子PAT Token到期检测
  const tokenExpires = process.env.COZE_PAT_TOKEN_EXPIRES;
  if (tokenExpires) {
    const expiresAt = new Date(tokenExpires);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    results.cozeToken = {
      expiresAt: tokenExpires,
      daysLeft: Math.max(0, daysLeft),
      isExpired: daysLeft <= 0,
      source: "env_var",
    };
  } else {
    results.cozeToken = { expiresAt: null, daysLeft: null, isExpired: true, source: "未配置" };
  }

  return NextResponse.json(results);
}
