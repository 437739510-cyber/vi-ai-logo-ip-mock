// TICKET-122-R18-R1 验证脚本（本地，不触碰生产库）：
// 1) hash -> verify 往返正确；
// 2) isPasswordHash 判别正确；
// 3) 模拟 members 登录懒迁移（n:1 还原 src/app/api/member/login/route.ts 分支）：
//    新哈希账号直接可登录；旧明文账号登录成功并自动升级为哈希；
//    错误密码不通过、不迁移；无密码（空）账号不能走密码登录、不迁移。

import { hashPassword, verifyPassword, isPasswordHash } from "../src/lib/password";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
  console.log(`  ok: ${msg}`);
}

async function main(): Promise<void> {
  console.log("=== 1) hash -> verify 往返 ===");
  const pw = "Member@2026!";
  const h = hashPassword(pw);
  assert(isPasswordHash(h), "hashPassword 输出是合法哈希格式");
  assert(verifyPassword(pw, h) === true, "正确密码 verify 通过");
  assert(verifyPassword("wrong-pass", h) === false, "错误密码 verify 不通过");

  // 随机盐 -> 两次哈希不同
  const h2 = hashPassword(pw);
  assert(h !== h2, "两次哈希因随机盐而不同");
  assert(verifyPassword(pw, h2) === true, "第二次哈希仍可校验");

  // 旧明文兼容：verifyPassword 对非哈希按明文比对
  const legacy = "legacy-secret-123";
  assert(isPasswordHash(legacy) === false, "旧明文被判为非哈希");
  assert(verifyPassword(legacy, legacy) === true, "旧明文密码 verify 按明文比对通过");
  assert(verifyPassword("wrong", legacy) === false, "旧明文错误密码不通过");

  // 空/畸形值安全
  assert(isPasswordHash(null) === false, "null 不是哈希");
  assert(isPasswordHash("") === false, "空串不是哈希");
  assert(isPasswordHash("scrypt$abc$def") === false, "畸形前缀串不是哈希");
  assert(verifyPassword("x", null as any) === false, "null stored verify 为 false");

  console.log("");
  console.log("=== 2) 模拟 members 登录懒迁移（还原 src/app/api/member/login/route.ts 分支） ===");
  // 行结构模拟 members
  interface Row {
    id: string;
    password_hash: string | null;
    migrated: boolean;
  }

  const rows: Row[] = [
    { id: "new-hash", password_hash: hashPassword("NewHashPass1"), migrated: false },
    { id: "legacy", password_hash: "legacy-plaintext-pw", migrated: false },
    { id: "legacy-bad", password_hash: "legacy-plaintext-pw", migrated: false },
    { id: "no-password", password_hash: null, migrated: false },
  ];

  function simulateLogin(row: Row, password: string): { ok: boolean; migrated: boolean } {
    const stored = row.password_hash;
    const isHash = isPasswordHash(stored);
    const ok = verifyPassword(password, stored);
    if (!ok) return { ok: false, migrated: false };
    let migrated = false;
    if (!isHash) {
      // 懒迁移：登录成功后立即用哈希覆盖该行
      row.password_hash = hashPassword(password);
      row.migrated = true;
      migrated = true;
    }
    return { ok: true, migrated };
  }

  // 新哈希账号：登录成功且不触发迁移
  const r1 = simulateLogin(rows[0], "NewHashPass1");
  assert(r1.ok === true, "新哈希账号可登录");
  assert(r1.migrated === false, "新哈希账号不迁移");

  // 旧明文账号：登录成功并自动升级为哈希
  const r2 = simulateLogin(rows[1], "legacy-plaintext-pw");
  assert(r2.ok === true, "旧明文账号登录成功");
  assert(r2.migrated === true, "旧明文账号触发懒迁移");
  assert(isPasswordHash(rows[1].password_hash as string) === true, "懒迁移后该行已是哈希");
  assert(rows[1].password_hash !== "legacy-plaintext-pw", "懒迁移后不再存明文");
  assert(verifyPassword("legacy-plaintext-pw", rows[1].password_hash) === true, "懒迁移后可正常校验");

  // 旧明文 + 错误密码：不通过、不迁移
  const r3 = simulateLogin(rows[2], "WRONG-PASSWORD");
  assert(r3.ok === false, "错误密码登录失败");
  assert(r3.migrated === false, "错误密码不迁移");
  assert(isPasswordHash(rows[2].password_hash as string) === false, "失败路径该行仍为明文（未写库）");

  // 无密码（空）账号：不能走密码登录、不触发迁移
  const r4 = simulateLogin(rows[3], "whatever-password");
  assert(r4.ok === false, "无密码账号不能走密码登录");
  assert(r4.migrated === false, "无密码账号不迁移");
  assert(rows[3].password_hash === null, "无密码账号 password_hash 保持为空（未写库）");

  console.log("");
  console.log("ALL ASSERTIONS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
