export const dynamic = "force-dynamic"
﻿/**
 * LiblibAI Account Balance Query
 * GET /api/billing/liblibai-balance
 *
 * Calls LiblibAI OpenAPI with HMAC-SHA1 signing.
 * Note: LiblibAI may not expose a public balance endpoint.
 * When unavailable, returns status "unavailable" gracefully.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";

const BASE_URL = "https://openapi.liblibai.cloud";
const BALANCE_PATH = "/api/v1/balance";

function signRequest(
  urlPath: string,
  accessKey: string,
  secretKey: string
): string {
  const ts = Date.now().toString();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 16; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)];
  }
  const raw = urlPath + "&" + ts + "&" + nonce;
  const sig = crypto
    .createHmac("sha1", secretKey)
    .update(raw)
    .digest();
  const sigBase64 = sig
    .toString("base64url")
    .replace(/=+$/, "");
  return (
    BASE_URL +
    urlPath +
    "?AccessKey=" +
    accessKey +
    "&Signature=" +
    sigBase64 +
    "&Timestamp=" +
    ts +
    "&SignatureNonce=" +
    nonce
  );
}

export async function GET() {
  const accessKey = process.env.LIBLIBAI_ACCESS_KEY;
  const secretKey = process.env.LIBLIBAI_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return NextResponse.json(
      {
        provider: "LiblibAI (Star-3 Alpha)",
        balance: null,
        currency: "积分",
        status: "no_key",
      },
      { status: 503 }
    );
  }

  try {
    const url = signRequest(BALANCE_PATH, accessKey, secretKey);
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error("[liblibai-balance] HTTP error:", res.status);
      return NextResponse.json(
        {
          provider: "LiblibAI (Star-3 Alpha)",
          balance: null,
          currency: "积分",
          status: "error",
          error: "API returned " + res.status,
        },
        { status: 503 }
      );
    }

    // code === 0 means success with data
    if (body.code === 0 && body.data) {
      const balance =
        typeof body.data.balance === "number"
          ? body.data.balance
          : parseInt(body.data.balance, 10) || 0;
      return NextResponse.json({
        provider: "LiblibAI (Star-3 Alpha)",
        balance,
        currency: "积分",
        status: "active",
      });
    }

    // code !== 0 — balance endpoint not available in this API tier
    console.warn("[liblibai-balance] API code:", body.code, body.msg);
    return NextResponse.json(
      {
        provider: "LiblibAI (Star-3 Alpha)",
        balance: null,
        currency: "积分",
        status: "unavailable",
        error: "API 不提供余额查询",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[liblibai-balance] Request failed:", err);
    return NextResponse.json(
      {
        provider: "LiblibAI (Star-3 Alpha)",
        balance: null,
        currency: "积分",
        status: "error",
        error: "接口请求失败",
      },
      { status: 503 }
    );
  }
}
