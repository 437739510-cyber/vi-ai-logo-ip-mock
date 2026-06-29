import { NextResponse } from "next/server";

/**
 * GET /api/ai/ark-balance
 * 
 * Called by billing page and project detail page to show ARK Seedream quota.
 * ARK (Volcengine) quota is exhausted — always returns zero balance.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const API_KEY = process.env.ARK_API_KEY;

  if (!API_KEY) {
    return NextResponse.json({
      provider: "ARK Seedream (Volcengine)",
      balance: 0,
      used: 0,
      total: 0,
      currency: "CNY",
      status: "no_key",
    });
  }

  return NextResponse.json({
    provider: "ARK Seedream (Volcengine)",
    balance: 0,
    used: 0,
    total: 0,
    currency: "CNY",
    status: "exhausted",
  });
}
