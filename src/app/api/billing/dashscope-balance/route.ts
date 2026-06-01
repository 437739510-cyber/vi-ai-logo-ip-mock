/**
 * DashScope / Aliyun Account Balance Query
 *
 * Tries to query real Aliyun account balance via BssOpenApi QueryAccountBalance.
 * Falls back to DASHSCOPE_ACCOUNT_BALANCE env var if AK credentials not configured.
 *
 * Env vars for real-time query:
 *   ALIBABA_CLOUD_ACCESS_KEY_ID
 *   ALIBABA_CLOUD_ACCESS_KEY_SECRET
 *
 * Fallback env var (manual update):
 *   DASHSCOPE_ACCOUNT_BALANCE
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";

const BSS_ENDPOINT = "https://business.aliyuncs.com";
const BSS_API_VERSION = "2017-12-14";

interface BalanceResponse {
  availableAmount: number;
  availableCashAmount: number;
  currency: string;
  source: "aliyun_api" | "env_var" | "error";
}

/**
 * Percent-encode per Aliyun RESTful API spec (uppercase hex, unreserved chars excluded).
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/**
 * Build Aliyun RESTful API signature.
 */
function signRequest(
  params: Record<string, string>,
  accessKeySecret: string
): string {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQuery = sortedKeys
    .map((key) => percentEncode(key) + "=" + percentEncode(params[key]))
    .join("&");

  const stringToSign = "GET&" + percentEncode("/") + "&" + percentEncode(canonicalizedQuery);

  const hmac = crypto.createHmac("sha1", accessKeySecret + "&");
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

/**
 * Call Aliyun BssOpenApi QueryAccountBalance using AccessKey auth.
 */
async function queryFromAliyunApi(): Promise<BalanceResponse | null> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    return null; // Keys not configured, fall through
  }

  const params: Record<string, string> = {
    Action: "QueryAccountBalance",
    Format: "JSON",
    Version: BSS_API_VERSION,
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: Date.now().toString() + Math.random().toString(36).slice(2),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };

  const signature = signRequest(params, accessKeySecret);
  params.Signature = signature;

  const queryString = Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");

  try {
    const res = await fetch(BSS_ENDPOINT + "/?" + queryString, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("[dashscope-balance] Aliyun API error:", res.status, await res.text());
      return null;
    }

    const body = await res.json();
    const availableAmount = parseFloat(body?.Data?.AvailableAmount);

    if (isNaN(availableAmount)) {
      console.error("[dashscope-balance] Unexpected Aliyun response:", JSON.stringify(body));
      return null;
    }

    return {
      availableAmount: availableAmount,
      availableCashAmount: parseFloat(body?.Data?.AvailableCashAmount) || 0,
      currency: body?.Data?.Currency || "CNY",
      source: "aliyun_api",
    };
  } catch (err) {
    console.error("[dashscope-balance] Aliyun API call failed:", err);
    return null;
  }
}

/**
 * Fallback: read from DASHSCOPE_ACCOUNT_BALANCE env var.
 */
function queryFromEnvVar(): BalanceResponse | null {
  const raw = process.env.DASHSCOPE_ACCOUNT_BALANCE;
  if (!raw) return null;
  const balance = parseFloat(raw);
  if (isNaN(balance)) return null;
  return { availableAmount: balance, availableCashAmount: balance, currency: "CNY", source: "env_var" };
}

export async function GET() {
  // Try Aliyun API first
  const apiResult = await queryFromAliyunApi();
  if (apiResult) {
    return NextResponse.json(apiResult);
  }

  // Fallback: env var
  const envResult = queryFromEnvVar();
  if (envResult) {
    return NextResponse.json(envResult);
  }

  // Neither available
  return NextResponse.json(
    {
      availableAmount: null,
      availableCashAmount: null,
      currency: "CNY",
      source: "error",
      error: "余额读取失败，请检查阿里云账务权限或设置 DASHSCOPE_ACCOUNT_BALANCE 环境变量",
    },
    { status: 503 }
  );
}
