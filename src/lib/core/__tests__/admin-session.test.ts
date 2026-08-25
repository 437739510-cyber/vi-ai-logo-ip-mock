/**
 * TICKET-133-R38 管理后台安全加固冒烟测试（纯内存 mock，不触库）。
 * Run: npx tsx src/lib/core/__tests__/admin-session.test.ts
 */
import {
  ADMIN_LOGIN_LOCK_SECONDS,
  ADMIN_LOGIN_MAX_FAILURES,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminSessionCookieOptions,
  createAdminSession,
  getLoginLockStatus,
  recordLoginFailure,
  recordLoginSuccess,
  resolveAdminSessionTtlSeconds,
  verifyAdminSession,
  type LoginGuardRecord,
} from "../admin-session";
import { logAdminOperation } from "../admin-operation-log";
import type { SupabaseClient } from "@supabase/supabase-js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

const SECRET = "test-admin-session-secret-0123456789abcdef";
const ACCOUNT = "13800000000";
const IP = "203.0.113.7";

async function main(): Promise<void> {
  // ---- 登录失败锁定：5 次连续失败 -> 锁定 15 分钟 ----
  const store = new Map<string, LoginGuardRecord>();
  let now = 1_000_000;
  const lockOpts = { store, maxFailures: ADMIN_LOGIN_MAX_FAILURES, lockSeconds: ADMIN_LOGIN_LOCK_SECONDS };

  let st = getLoginLockStatus(ACCOUNT, IP, { ...lockOpts, nowSeconds: now });
  assert(st.locked === false && st.failures === 0, "初始未锁定、失败次数 0");

  for (let i = 1; i <= ADMIN_LOGIN_MAX_FAILURES; i++) {
    st = recordLoginFailure(ACCOUNT, IP, { ...lockOpts, nowSeconds: now });
  }
  assert(st.locked === true, "第 5 次失败后锁定");
  assert(st.remainingSeconds === ADMIN_LOGIN_LOCK_SECONDS, "锁定时剩余时间 = 900s");
  assert(st.failures === ADMIN_LOGIN_MAX_FAILURES, "锁定时失败次数 = 5");

  st = recordLoginFailure(ACCOUNT, IP, { ...lockOpts, nowSeconds: now });
  assert(st.locked === true, "第 6 次失败仍保持锁定");
  assert(st.remainingSeconds === ADMIN_LOGIN_LOCK_SECONDS, "锁定剩余时间不因继续失败而延长");

  st = getLoginLockStatus(ACCOUNT, IP, { ...lockOpts, nowSeconds: now + ADMIN_LOGIN_LOCK_SECONDS });
  assert(st.locked === false, "锁定到期后自动解锁");
  assert(st.failures === 0, "锁定到期后失败计数清零");

  // 账号维度与 IP 维度独立计数：同账号换 IP 命中账号计数；同 IP 换账号命中 IP 计数
  const store2 = new Map<string, LoginGuardRecord>();
  for (let i = 1; i <= ADMIN_LOGIN_MAX_FAILURES; i++) {
    recordLoginFailure(ACCOUNT, "198.51.100.9", { store: store2, nowSeconds: now });
  }
  st = getLoginLockStatus(ACCOUNT, "198.51.100.9", { store: store2, nowSeconds: now });
  assert(st.locked === true, "按账号计数：换 IP 仍锁定");
  st = getLoginLockStatus("other-account", "198.51.100.9", { store: store2, nowSeconds: now });
  assert(st.locked === true, "按 IP 计数：同 IP 换账号仍锁定");

  // 登录成功清除计数
  const store3 = new Map<string, LoginGuardRecord>();
  recordLoginFailure(ACCOUNT, IP, { store: store3, nowSeconds: now });
  recordLoginSuccess(ACCOUNT, IP, { store: store3 });
  st = getLoginLockStatus(ACCOUNT, IP, { store: store3, nowSeconds: now });
  assert(st.failures === 0 && st.locked === false, "登录成功清除失败计数");

  // ---- 会话 TTL（默认 12h，可配置 1-24h）----
  const prevEnv = process.env.ADMIN_SESSION_TTL_HOURS;
  try {
    delete process.env.ADMIN_SESSION_TTL_HOURS;
    assert(resolveAdminSessionTtlSeconds() === 12 * 60 * 60, "默认 TTL = 12h(43200s)");
    assert(adminSessionCookieOptions().maxAge === 12 * 60 * 60, "cookie maxAge 默认 = 43200");
    process.env.ADMIN_SESSION_TTL_HOURS = "24";
    assert(resolveAdminSessionTtlSeconds() === 24 * 60 * 60, "env=24 -> 86400");
    process.env.ADMIN_SESSION_TTL_HOURS = "0";
    assert(resolveAdminSessionTtlSeconds() === 12 * 60 * 60, "env=0 回退默认");
    process.env.ADMIN_SESSION_TTL_HOURS = "abc";
    assert(resolveAdminSessionTtlSeconds() === 12 * 60 * 60, "env 非法回退默认");
  } finally {
    if (prevEnv === undefined) delete process.env.ADMIN_SESSION_TTL_HOURS;
    else process.env.ADMIN_SESSION_TTL_HOURS = prevEnv;
  }
  assert(resolveAdminSessionTtlSeconds("1") === 60 * 60, "显式参数 1h");
  assert(resolveAdminSessionTtlSeconds("100") === 24 * 60 * 60, "显式参数钳制到 24h");

  // ---- 会话创建 / 校验 / 过期 ----
  const t0 = 1_000_000;
  const token = await createAdminSession("admin", "admin", { secret: SECRET, nowSeconds: t0, ttlSeconds: 3600 });
  assert(typeof token === "string" && token.length > 0, "createAdminSession 生成 token");

  const valid = await verifyAdminSession(token!, { secret: SECRET, nowSeconds: t0 + 3599 });
  assert(valid?.role === "admin" && valid?.userId === "admin" && valid?.expiresAt === t0 + 3600, "未过期会话可验证");
  const expired = await verifyAdminSession(token!, { secret: SECRET, nowSeconds: t0 + 3601 });
  assert(expired === null, "过期会话验证返回 null");
  const badSig = await verifyAdminSession(token!.slice(0, -2) + "aa", { secret: SECRET, nowSeconds: t0 + 1 });
  assert(badSig === null, "篡改签名验证返回 null");

  const overTtl = await createAdminSession("admin", "admin", {
    secret: SECRET,
    nowSeconds: t0,
    ttlSeconds: ADMIN_SESSION_MAX_AGE_SECONDS + 1,
  });
  assert(overTtl === null, "超过硬上限 TTL 拒绝创建");

  const stuToken = await createAdminSession("student", "stu-1", { secret: SECRET, nowSeconds: t0, ttlSeconds: 3600 });
  const stu = await verifyAdminSession(stuToken!, { secret: SECRET, nowSeconds: t0 + 60 });
  assert(stu?.role === "student" && stu?.userId === "stu-1", "student 会话可验证");

  // ---- 审计写入（mock 不触库）----
  const insertedRows: unknown[] = [];
  const mockDb = {
    from: () => ({
      insert: async (row: unknown) => {
        insertedRows.push(row);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;

  await logAdminOperation(mockDb, {
    operatorId: "op-1",
    operatorRole: "admin",
    action: "test_action",
    entityType: "projects",
    entityIds: ["p1", "p2"],
    detail: { note: "unit" },
  });
  assert(insertedRows.length === 1, "审计写入 1 行");
  const row = insertedRows[0] as Record<string, unknown>;
  assert(typeof row.id === "string" && row.id.startsWith("op_"), "审计行生成 id");
  assert(row.operator_id === "op-1" && row.operator_role === "admin", "审计行含操作人/角色");
  assert(row.action === "test_action" && row.entity_type === "projects", "审计行含动作/实体");
  assert(Array.isArray(row.entity_ids) && row.entity_ids.length === 2, "审计行含实体 ID 列表");
  assert(typeof row.created_at === "string", "审计行含 created_at");

  // 写入抛错不阻断（best-effort）
  const failingDb = {
    from: () => ({
      insert: async () => {
        throw new Error("db down");
      },
    }),
  } as unknown as SupabaseClient;
  let auditThrew = false;
  try {
    await logAdminOperation(failingDb, {
      operatorId: "op-2",
      operatorRole: "admin",
      action: "boom",
      entityType: "x",
      entityIds: [],
    });
  } catch {
    auditThrew = true;
  }
  assert(auditThrew === false, "审计写入失败不抛出（best-effort）");

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("test crashed:", error);
  process.exit(1);
});