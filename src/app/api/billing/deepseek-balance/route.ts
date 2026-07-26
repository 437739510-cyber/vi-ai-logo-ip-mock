export const dynamic = "force-dynamic"
/**
 * DeepSeek Account Balance Query V2
 * 浣跨敤 DeepSeek 瀹樻柟浣欓鏌ヨAPI
 * GET https://api.deepseek.com/user/balance
 */
import { NextResponse } from "next/server";
import { DEEPSEEK_BASE_URL } from "@/lib/core/billing/deepseek-guard";

export async function GET() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { balance: null, source: "error", error: "DeepSeek API Key 鏈厤缃紝璇疯缃?DEEPSEEK_API_KEY 鐜鍙橀噺" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/user/balance`, {
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
        { balance: null, source: "error", error: `DeepSeek API 杩斿洖閿欒 (${res.status})` },
        { status: 503 }
      );
    }

    const body = await res.json();
    // DeepSeek 杩斿洖鏍煎紡: { balance_infos: [{ currency: "CNY", total_balance: "10.00", granted_balance: "5.00", topped_up_balance: "5.00" }] }
    const balanceInfos = body?.balance_infos || [];
    const cnyInfo = balanceInfos.find((b: any) => b.currency === "CNY") || balanceInfos[0];
    const totalBalance = cnyInfo ? parseFloat(cnyInfo.total_balance) : 0;

    if (isNaN(totalBalance)) {
      console.error("[deepseek-balance] Unexpected response:", JSON.stringify(body));
      return NextResponse.json(
        { balance: null, source: "error", error: "DeepSeek 杩斿洖鏁版嵁鏍煎紡寮傚父" },
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
      { balance: null, source: "error", error: "DeepSeek 浣欓鏌ヨ璇锋眰澶辫触" },
      { status: 503 }
    );
  }
}
