export const ADMIN_SESSION_COOKIE = "bb_admin_session";
export const ADMIN_SESSION_DEFAULT_TTL_HOURS = 12;
export const ADMIN_SESSION_MAX_TTL_HOURS = 24;
export const ADMIN_SESSION_VERSION = 1;
// 会话 TTL 硬上限（秒）：配置与校验都不能超过该值。
export const ADMIN_SESSION_MAX_AGE_SECONDS = ADMIN_SESSION_MAX_TTL_HOURS * 60 * 60;
export const ADMIN_SESSION_MIN_SECRET_LENGTH = 32;

export const ADMIN_LOGIN_MAX_FAILURES = 5;
export const ADMIN_LOGIN_LOCK_SECONDS = 15 * 60;

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

export interface LoginLockStatus {
  locked: boolean;
  remainingSeconds: number;
  failures: number;
}

export interface LoginGuardRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

export interface LoginGuardOptions {
  maxFailures?: number;
  lockSeconds?: number;
  nowSeconds?: number;
  store?: Map<string, LoginGuardRecord>;
}

export interface LoginGuardClearOptions {
  store?: Map<string, LoginGuardRecord>;
}

/**
 * 解析管理员会话 TTL（秒）。默认 12 小时，可用环境变量
 * ADMIN_SESSION_TTL_HOURS 配置（1-24 整数小时，越界回退默认值）。
 */
export function resolveAdminSessionTtlSeconds(envHours?: string): number {
  const raw = envHours ?? process.env.ADMIN_SESSION_TTL_HOURS;
  const parsed = raw === undefined || raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_SESSION_DEFAULT_TTL_HOURS * 60 * 60;
  }
  const hours = Math.min(Math.max(Math.floor(parsed), 1), ADMIN_SESSION_MAX_TTL_HOURS);
  return hours * 60 * 60;
}

const loginGuardStore = new Map<string, LoginGuardRecord>();

function loginGuardAccountKey(account: string): string {
  return `account:${account.trim().toLowerCase()}`;
}

function loginGuardIpKey(ip: string): string {
  return `ip:${ip.trim().toLowerCase()}`;
}

function readLoginGuardRecord(
  store: Map<string, LoginGuardRecord>,
  key: string,
  nowSeconds: number,
  lockSeconds: number,
): LoginGuardRecord {
  const record = store.get(key);
  if (!record) {
    return { failures: 0, firstFailureAt: nowSeconds, lockedUntil: 0 };
  }
  if (record.lockedUntil > 0 && record.lockedUntil <= nowSeconds) {
    return { failures: 0, firstFailureAt: nowSeconds, lockedUntil: 0 };
  }
  if (record.lockedUntil === 0 && nowSeconds - record.firstFailureAt >= lockSeconds) {
    return { failures: 0, firstFailureAt: nowSeconds, lockedUntil: 0 };
  }
  return record;
}

function toLoginLockStatus(records: LoginGuardRecord[], nowSeconds: number): LoginLockStatus {
  const lockedRecord = records.find((record) => record.lockedUntil > nowSeconds);
  const locked = lockedRecord !== undefined;
  const remainingSeconds = lockedRecord ? Math.max(0, lockedRecord.lockedUntil - nowSeconds) : 0;
  const failures = records.reduce((max, record) => Math.max(max, record.failures), 0);
  return { locked, remainingSeconds, failures };
}

export function getLoginLockStatus(account: string, ip: string, options: LoginGuardOptions = {}): LoginLockStatus {
  const lockSeconds = options.lockSeconds ?? ADMIN_LOGIN_LOCK_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const store = options.store ?? loginGuardStore;
  const accountRecord = readLoginGuardRecord(store, loginGuardAccountKey(account), nowSeconds, lockSeconds);
  const ipRecord = readLoginGuardRecord(store, loginGuardIpKey(ip), nowSeconds, lockSeconds);
  return toLoginLockStatus([accountRecord, ipRecord], nowSeconds);
}

export function recordLoginFailure(account: string, ip: string, options: LoginGuardOptions = {}): LoginLockStatus {
  const maxFailures = options.maxFailures ?? ADMIN_LOGIN_MAX_FAILURES;
  const lockSeconds = options.lockSeconds ?? ADMIN_LOGIN_LOCK_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const store = options.store ?? loginGuardStore;

  const bump = (key: string): LoginGuardRecord => {
    const current = readLoginGuardRecord(store, key, nowSeconds, lockSeconds);
    const next: LoginGuardRecord = {
      failures: current.failures + 1,
      firstFailureAt: current.firstFailureAt,
      lockedUntil: current.lockedUntil > nowSeconds ? current.lockedUntil : 0,
    };
    if (next.lockedUntil === 0 && next.failures >= maxFailures) {
      next.lockedUntil = nowSeconds + lockSeconds;
    }
    store.set(key, next);
    return next;
  };

  const accountRecord = bump(loginGuardAccountKey(account));
  const ipRecord = bump(loginGuardIpKey(ip));
  return toLoginLockStatus([accountRecord, ipRecord], nowSeconds);
}

export function recordLoginSuccess(account: string, ip: string, options: LoginGuardClearOptions = {}): void {
  const store = options.store ?? loginGuardStore;
  store.delete(loginGuardAccountKey(account));
  store.delete(loginGuardIpKey(ip));
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
  const ttlSeconds = options.ttlSeconds ?? resolveAdminSessionTtlSeconds();
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

export function adminSessionCookieOptions(maxAge = resolveAdminSessionTtlSeconds()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}
