export const ADMIN_SESSION_COOKIE = "bb_admin_session";
export const ADMIN_SESSION_VERSION = 1;
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_SESSION_MIN_SECRET_LENGTH = 32;

export type AdminSessionRole = "admin" | "student";

export interface AdminSession {
  version: 1;
  role: AdminSessionRole;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

interface SessionOptions {
  secret?: string;
  nowSeconds?: number;
  ttlSeconds?: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function resolveSecret(explicitSecret?: string): string | null {
  const secret = explicitSecret ?? process.env.ADMIN_SESSION_SECRET;
  return typeof secret === "string" && secret.length >= ADMIN_SESSION_MIN_SECRET_LENGTH ? secret : null;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createAdminSession(
  role: AdminSessionRole,
  userId: string,
  options: SessionOptions = {},
): Promise<string | null> {
  const secret = resolveSecret(options.secret);
  const normalizedUserId = userId.trim();
  const ttlSeconds = options.ttlSeconds ?? ADMIN_SESSION_MAX_AGE_SECONDS;
  if (!secret || !normalizedUserId || !["admin", "student"].includes(role)) return null;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > ADMIN_SESSION_MAX_AGE_SECONDS) return null;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const payload: AdminSession = {
    version: ADMIN_SESSION_VERSION,
    role,
    userId: normalizedUserId,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyAdminSession(
  token: string | undefined,
  options: Pick<SessionOptions, "secret" | "nowSeconds"> = {},
): Promise<AdminSession | null> {
  const secret = resolveSecret(options.secret);
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  const payloadBytes = base64UrlDecode(encodedPayload);
  const signatureBytes = base64UrlDecode(encodedSignature);
  if (!payloadBytes || !signatureBytes) return null;
  try {
    const key = await importHmacKey(secret);
    const signature = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength,
    ) as ArrayBuffer;
    const signatureValid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(encodedPayload));
    if (!signatureValid) return null;
    const parsed: unknown = JSON.parse(decoder.decode(payloadBytes));
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Record<string, unknown>;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.version !== ADMIN_SESSION_VERSION) return null;
    if (payload.role !== "admin" && payload.role !== "student") return null;
    if (typeof payload.userId !== "string" || !payload.userId.trim()) return null;
    if (!Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt)) return null;
    const issuedAt = payload.issuedAt as number;
    const expiresAt = payload.expiresAt as number;
    if (issuedAt <= 0 || issuedAt > now + 60) return null;
    if (expiresAt <= now || expiresAt <= issuedAt || expiresAt - issuedAt > ADMIN_SESSION_MAX_AGE_SECONDS) return null;
    return { version: 1, role: payload.role, userId: payload.userId.trim(), issuedAt, expiresAt };
  } catch {
    return null;
  }
}

export function adminSessionCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}
