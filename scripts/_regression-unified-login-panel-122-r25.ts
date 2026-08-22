// TICKET-122-R25 统一登录面板离线回归（不连生产库、不调网络）。
// 1) mock 数据库直测 resolveLoginIdentity：学生号→student、会员号→member、
//    未知→none、双表存在→student 优先、非法手机号→抛错；
// 2) 源码断言：首页导航登录按钮 + 面板挂载、面板分流步骤、登录复用现有
//    /api/member/login 与 /api/admin/login、成功跳转对应 dashboard、
//    未知号码提示注册/申请入口、管理员入口保留、管理后台登录入口不动。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveLoginIdentity,
  PHONE_RE,
  type LoginIdentity,
} from "../src/lib/auth-identity";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

class MockQuery {
  private where: Array<[string, any]> = [];
  private selectCols: string | null = null;
  private maybeSingleFlag = false;

  constructor(private store: TableMap, private table: string) {}

  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }

  eq(col: string, value: any) {
    this.where.push([col, value]);
    return this;
  }

  maybeSingle() {
    this.maybeSingleFlag = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.where.every(([c, v]) => row[c] === v);
  }

  private run(): { data: Row | Row[] | null; error: any } {
    const table = this.store[this.table] ?? [];
    const rows = table.filter((r) => this.matches(r));
    if (this.maybeSingleFlag) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  then(onSuccess: (v: any) => void) {
    onSuccess(this.run());
  }
}

class MockSupabase {
  constructor(public store: TableMap) {}
  from(table: string) {
    return new MockQuery(this.store, table);
  }
}

function seed(): TableMap {
  return {
    student_accounts: [
      { id: "stu-1", phone: "13900000001", name: "学生甲", active: true },
    ],
    members: [
      { id: "mem-1", phone: "13800000002", name: "商家乙" },
    ],
  };
}

async function expectIdentity(db: any, phone: string, expected: LoginIdentity, label: string) {
  const identity = await resolveLoginIdentity(db, phone);
  assert.equal(identity, expected, label);
}

async function main() {
  // ---------- 1) 分流逻辑功能回归（mock DB） ----------
  const db = new MockSupabase(seed()) as any;

  await expectIdentity(db, "13900000001", "student", "student_accounts 手机号 → student");
  await expectIdentity(db, "13800000002", "member", "members 手机号 → member");
  await expectIdentity(db, "13700000000", "none", "两表均无 → none（提示注册/申请）");

  // 双表同时存在：student 优先（与工单列举顺序一致）
  const dbBoth = new MockSupabase({
    student_accounts: [{ id: "stu-2", phone: "13600000003" }],
    members: [{ id: "mem-2", phone: "13600000003" }],
  }) as any;
  await expectIdentity(dbBoth, "13600000003", "student", "双表存在优先 student");

  // 非法手机号抛 INVALID_PHONE
  await assert.rejects(resolveLoginIdentity(db, "123"), /INVALID_PHONE/, "非法手机号抛错");
  await assert.rejects(resolveLoginIdentity(db, ""), /INVALID_PHONE/, "空手机号抛错");
  await assert.rejects(resolveLoginIdentity(db, "110"), /INVALID_PHONE/, "非法号段抛错");

  // 手机号校验正则：合法号段 + 11 位
  assert.equal(PHONE_RE.test("13900000001"), true, "合法手机号通过");
  assert.equal(PHONE_RE.test("12900000001"), false, "12 号段拒绝");
  assert.equal(PHONE_RE.test("1390000000"), false, "10 位拒绝");

  // ---------- 2) 身份识别路由源码断言 ----------
  const route = readFileSync("src/app/api/auth/identity/route.ts", "utf8");
  assert.match(route, /resolveLoginIdentity\(supabaseAdmin, phone\)/, "路由调用身份识别逻辑");
  assert.match(route, /success: true, identity/, "路由返回 identity");
  assert.match(route, /PHONE_RE\.test\(phone\)/, "路由校验手机号格式");
  assert.equal(route.includes("member_sessions"), false, "识别路由不创建会话");
  assert.equal(route.includes("password"), false, "识别路由不接收密码");

  // ---------- 3) 首页导航与统一面板源码断言 ----------
  const layout = readFileSync("src/components/shared/ClientLayout.tsx", "utf8");
  assert.match(layout, /UnifiedLoginPanel/, "首页布局挂载统一登录面板");
  assert.match(layout, /setLoginOpen\(true\)/, "导航登录按钮打开面板");
  assert.equal(
    layout.split("setLoginOpen(true)").length - 1 >= 2,
    true,
    "桌面端与移动端均有登录入口"
  );

  const panel = readFileSync("src/components/client/UnifiedLoginPanel.tsx", "utf8");
  // 分流：先按手机号识别
  assert.match(panel, /\/api\/auth\/identity/, "面板调用身份识别接口");
  assert.match(panel, /data\.identity === "student"/, "学生号 → 大学生面板");
  assert.match(panel, /data\.identity === "member"/, "会员号 → 商家面板");
  assert.match(panel, /setStep\("none"\)/, "未知号码 → 提示面板");
  // 登录复用现有 API（不新增登录接口）
  assert.match(panel, /\/api\/member\/login/, "商家登录复用 /api/member/login");
  assert.match(panel, /mode: "password"/, "商家登录走密码模式");
  assert.match(panel, /\/api\/admin\/login/, "大学生登录复用 /api/admin/login");
  // 成功跳转对应 dashboard
  assert.match(panel, /window\.location\.href = "\/member\/dashboard"/, "会员成功跳转会员中心");
  assert.match(panel, /window\.location\.href = "\/admin\/dashboard"/, "学生成功跳转合伙人工作台");
  // 未知号码的注册/申请入口
  assert.match(panel, /href="\/member\/login"/, "未知号码提供商家注册/开通入口");
  assert.match(panel, /href="\/student\/register"/, "未知号码提供大学生申请入口");
  // 管理员入口保留（/admin/login 不动）
  assert.match(panel, /href="\/admin\/login"/, "面板保留管理员入口");
  assert.equal(
    readFileSync("src/app/admin/login/page.tsx", "utf8").includes("管理后台"),
    true,
    "/admin/login 页面未移除"
  );

  console.log("TICKET-122-R25 unified-login-panel regression: ALL ASSERTIONS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
