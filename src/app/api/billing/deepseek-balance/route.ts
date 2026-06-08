/**
 * DeepSeek Account Balance Query V2
 * 使用 DeepSeek 官方余额查询API
 * GET https://api.deepseek.com/user/balance
 */
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { balance: null, source: "error", error: "DeepSeek API Key 未配置，请设置 DEEPSEEK_API_KEY 环境变量" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[deepseek-balance] API error:", res.status, errText);
      return NextResponse.json(
        { balance: null, source: "error", error: `DeepSeek API 返回错误 (${res.status})` },
        { status: 503 }
      );
    }

    const body = await res.json();
    // DeepSeek 返回格式: { balance_infos: [{ currency: "CNY", total_balance: "10.00", granted_balance: "5.00", topped_up_balance: "5.00" }] }
    const balanceInfos = body?.balance_infos || [];
    const cnyInfo = balanceInfos.find((b: any) => b.currency === "CNY") || balanceInfos[0];
    const totalBalance = cnyInfo ? parseFloat(cnyInfo.total_balance) : 0;

    if (isNaN(totalBalance)) {
      console.error("[deepseek-balance] Unexpected response:", JSON.stringify(body));
      return NextResponse.json(
        { balance: null, source: "error", error: "DeepSeek 返回数据格式异常" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      balance: totalBalance,
      source: "deepseek_api",
      currency: cnyInfo?.currency || "CNY",
      granted: cnyInfo ? parseFloat(cnyInfo.granted_balance) : 0,
      topped_up: cnyInfo ? parseFloat(cnyInfo.topped_up_balance) : 0,
    });
  } catch (err) {
    console.error("[deepseek-balance] Request failed:", err);
    return NextResponse.json(
      { balance: null, source: "error", error: "DeepSeek 余额查询请求失败" },
      { status: 503 }
    );
  }
}
