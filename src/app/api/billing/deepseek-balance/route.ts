/**
 * DeepSeek Account Balance Query
 *
 * DeepSeek does not currently provide a public balance query API.
 * Balance must be configured manually via environment variable:
 *   DEEPSEEK_ACCOUNT_BALANCE
 *
 * The user can check their DeepSeek console for current balance
 * and update the env var accordingly.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.DEEPSEEK_ACCOUNT_BALANCE;

  if (!raw) {
    return NextResponse.json(
      {
        balance: null,
        source: "error",
        error: "DeepSeek 余额未配置，请设置 DEEPSEEK_ACCOUNT_BALANCE 环境变量",
      },
      { status: 503 }
    );
  }

  const balance = parseFloat(raw);
  if (isNaN(balance)) {
    return NextResponse.json(
      {
        balance: null,
        source: "error",
        error: "DEEPSEEK_ACCOUNT_BALANCE 格式错误，请设为有效数字",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    balance,
    source: "env_var",
  });
}
