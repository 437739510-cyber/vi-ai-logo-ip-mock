import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt 密码哈希工具（TICKET-122-R18）。
// 零新依赖：使用 node:crypto，存储格式为 `scrypt$<saltB64>$<hashB64>`。

const PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * 判断存储值是否为合法 scrypt 哈希格式。
 * 用于区分“已是哈希”与“旧明文”，供登录懒迁移与迁移脚本使用。
 */
export function isPasswordHash(stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1] ?? "", "base64");
  const hash = Buffer.from(parts[2] ?? "", "base64");
  return salt.length === SALT_BYTES && hash.length === KEY_LENGTH;
}

/**
 * 对明文密码做 scrypt 哈希。
 */
export function hashPassword(password: string): string {
  if (typeof password !== "string") {
    throw new TypeError("password must be a string");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${PREFIX}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * 校验密码。
 * - 当存储值已是合法哈希时：做 scrypt 校验（恒定时间比较）。
 * - 当存储值是旧明文（长度/格式不匹配）时：按明文比对，用于登录懒迁移兼容。
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (typeof password !== "string" || !stored || typeof stored !== "string") return false;

  // 旧明文顺延比对
  if (!isPasswordHash(stored)) {
    return password === stored;
  }

  const [, saltB64, hashB64] = stored.split("$");
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
