// TICKET-122-R23 配额与订阅闭环 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到品牌管家服务层，验证：
//   1) 学生路径配额：生成前检查（超配额拒绝 + 明确提示）→ 成功扣减 quota_used
//   2) 订阅激活：付款审核通过（mark-paid）→ 按项目写订阅生效记录
//      （projects → submissions → members 反查；plan=manager、quota_total=12、quota_used=0）
//   3) 续费重置配额：生效期内续费周期顺延 30 天并重置 quota_used；过期后续费重开周期
//   4) 到期：周期到点惰性置 expired（syncSubscriptionPeriod）→ 生成路径拒绝「已到期」
//   5) 暂停/恢复：paused 拒绝「已暂停」；resume 恢复；无订阅/已到期暂停等边界
//   6) 既有配额语义：无订阅记录时回退 members.quota_used/quota_total（不破坏老数据）
//   7) API 路由接线：student-generate / member-generate / member-upload 走服务层，
//      mark-paid 调激活、upload-screenshot 记录 paidPlan、confirm 页提交 plan、
//      member/me 返回订阅状态、新订阅管理 API 会话门禁

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  SUBSCRIPTION_RULES,
  activateSubscriptionForProject,
  activateSubscriptionForMember,
  checkMemberQuota,
  consumeMemberQuota,
  getSubscription,
  pauseSubscription,
  resumeSubscription,
  syncSubscriptionPeriod,
  SubscriptionError,
} from "../src/lib/brand-steward";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

const BASE_NOW = new Date("2026-08-22T00:00:00.000Z");

class MockQuery {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string | null = null;
  private where: Array<["eq" | "neq" | "in", string, any]> = [];
  private orderBy: [string, { ascending?: boolean }] | null = null;
  private payload: Row | Row[] | null = null;
  private singleFlag = false;
  private maybeSingleFlag = false;

  constructor(private store: TableMap, private table: string) {}

  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }
  eq(col: string, value: any) {
    this.where.push(["eq", col, value]);
    return this;
  }
  neq(col: string, value: any) {
    this.where.push(["neq", col, value]);
    return this;
  }
  in(col: string, values: any[]) {
    this.where.push(["in", col, values]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = [col, opts ?? {}];
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = values;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  single() {
    this.singleFlag = true;
    return this;
  }
  maybeSingle() {
    this.maybeSingleFlag = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.where.every(([op, col, val]) => {
      const actual = row[col];
      if (op === "eq") {
        if (typeof val === "object" && val !== null) return actual === val;
        if (actual == null) return val == null;
        return String(actual) === String(val);
      }
      if (op === "neq") return actual !== val;
      if (op === "in") return (Array.isArray(val) ? val : []).some((v) => String(actual) === String(v));
      return false;
    });
  }

  private pick(row: Row): Row {
    if (!this.selectCols || this.selectCols === "*") return { ...row };
    const out: Row = {};
    for (const col of this.selectCols.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (col in row) out[col] = row[col];
    }
    return out;
  }

  private run(): { data: any; error: any } {
    const table = this.store[this.table] ?? (this.store[this.table] = []);

    if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
      const inserted: Row[] = [];
      for (const r of rows) {
        const row: Row = {
          id: `mock-${this.table}-${table.length + 1}-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...r,
        };
        table.push(row);
        inserted.push(row);
      }
      if (this.singleFlag) {
        return inserted.length
          ? { data: this.pick(inserted[0]), error: null }
          : { data: null, error: { message: "no rows" } };
      }
      return { data: inserted.map((r) => this.pick(r)), error: null };
    }

    if (this.op === "update") {
      const matched = table.filter((r) => this.matches(r));
      for (const r of matched) Object.assign(r, this.payload);
      const data = matched.map((r) => this.pick(r));
      if (this.singleFlag) {
        return data.length
          ? { data: data[0], error: null }
          : { data: null, error: { message: "no rows" } };
      }
      return { data, error: null };
    }

    if (this.op === "delete") {
      const matched = table.filter((r) => this.matches(r));
      const deleted = matched.map((r) => this.pick(r));
      this.store[this.table] = table.filter((r) => !this.matches(r));
      return { data: deleted, error: null };
    }

    // select
    let rows = table.filter((r) => this.matches(r));
    if (this.orderBy) {
      const [col, opts] = this.orderBy;
      rows = [...rows].sort((a, b) => {
        if (a[col] == null && b[col] == null) return 0;
        if (a[col] == null) return 1;
        if (b[col] == null) return -1;
        const av = String(a[col]);
        const bv = String(b[col]);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return opts?.ascending === false ? -cmp : cmp;
      });
    }
    const data = rows.map((r) => this.pick(r));
    if (this.maybeSingleFlag) {
      return data.length ? { data: data[0], error: null } : { data: null, error: null };
    }
    if (this.singleFlag) {
      if (data.length === 0) return { data: null, error: { message: "no rows" } };
      if (data.length > 1) return { data: null, error: { message: "multiple rows" } };
      return { data: data[0], error: null };
    }
    return { data, error: null };
  }

  then(onSuccess: (v: any) => void, onError?: (e: unknown) => void) {
    try {
      onSuccess(this.run());
    } catch (e) {
      onError?.(e);
    }
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
    members: [
      // m1：品牌管家（已激活订阅），5/12 条
      { id: "m1", phone: "13800000001", name: "老王", plan: "manager", quota_used: 5, quota_total: 12, created_at: "2026-08-01T00:00:00.000Z" },
      // m2：免费客户，1/2 条，付款购买品牌管家（等待管理员确认）
      { id: "m2", phone: "13800000002", name: "老李", plan: "free", quota_used: 1, quota_total: 2, created_at: "2026-08-01T00:00:00.000Z" },
      // m3：标准版（无订阅记录，老数据回退 members 配额）
      { id: "m3", phone: "13800000003", name: "老张", plan: "standard", quota_used: 8, quota_total: 10, created_at: "2026-08-01T00:00:00.000Z" },
      // m4：品牌管家但已过周期（用于到期测试）
      { id: "m4", phone: "13800000004", name: "老赵", plan: "manager", quota_used: 3, quota_total: 12, created_at: "2026-08-01T00:00:00.000Z" },
    ],
    submissions: [
      { id: "sub-pay", phone: "13800000002", company_name: "老李火锅", client_name: "老李", status: "submitted", student_id: null, created_at: "2026-08-20T00:00:00.000Z", submitted_at: "2026-08-20T00:00:00.000Z" },
    ],
    projects: [
      {
        id: "proj-pay",
        submission_id: "sub-pay",
        status: "payment_uploaded",
        client_name: "老李火锅",
        student_id: null,
        created_at: "2026-08-20T00:00:00.000Z",
        updated_at: "2026-08-20T00:00:00.000Z",
        client_info: { paidPlan: "manager" },
      },
    ],
    member_contents: [
      // 学生为 m1（品牌管家）生成的内容，尚未扣减
      { id: "c1", member_id: "m1", student_id: "s1", images: [], note: "", status: "pending", source: "student", platform: "xiaohongshu", created_at: "2026-08-21T00:00:00.000Z" },
      // 学生为 m4（品牌管家已到期）生成的内容
      { id: "c4", member_id: "m4", student_id: "s1", images: [], note: "", status: "pending", source: "student", platform: "xiaohongshu", created_at: "2026-08-21T00:00:00.000Z" },
    ],
    brand_steward_subscriptions: [
      // m1：生效中（8-01 起 30 天 → 8-31 到期）
      {
        id: "BS-m1",
        member_id: "m1",
        plan: "manager",
        status: "active",
        period_start: "2026-08-01T00:00:00.000Z",
        period_end: "2026-08-31T00:00:00.000Z",
        quota_total: 12,
        source_project_id: "proj-old",
        started_at: "2026-08-01T00:00:00.000Z",
        renewed_at: "2026-08-01T00:00:00.000Z",
        paused_at: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      // m4：周期已过（7-01 起 30 天 → 7-31 到期）
      {
        id: "BS-m4",
        member_id: "m4",
        plan: "manager",
        status: "active",
        period_start: "2026-07-01T00:00:00.000Z",
        period_end: "2026-07-31T00:00:00.000Z",
        quota_total: 12,
        source_project_id: "proj-old4",
        started_at: "2026-07-01T00:00:00.000Z",
        renewed_at: "2026-07-01T00:00:00.000Z",
        paused_at: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
}

async function expectError(promise: Promise<unknown>, status: number, msg: RegExp): Promise<void> {
  await assert.rejects(
    () => promise,
    (e: unknown) => e instanceof SubscriptionError && (e as SubscriptionError).status === status && msg.test((e as Error).message),
    `期望被拒（${status}）`,
  );
}

function daysAfter(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

async function main() {
  const store = seed();
  const db = new MockSupabase(store) as any;

  // 0) 规则常量
  assert.equal(SUBSCRIPTION_RULES.plan, "manager", "品牌管家档位 manager");
  assert.equal(SUBSCRIPTION_RULES.monthlyQuota, 12, "每月 12 条");
  assert.equal(SUBSCRIPTION_RULES.periodDays, 30, "生效期 30 天/周期");

  // 1) 学生路径：生效期内生成前检查通过 → 成功扣减
  const before = await checkMemberQuota(db, "m1", BASE_NOW);
  assert.equal(before.allowed, true, "m1 生效期内配额允许");
  assert.equal(before.subscription?.status, "active", "订阅状态 active");
  const consumed = await consumeMemberQuota(db, "m1", BASE_NOW);
  assert.equal(consumed.quotaUsed, 6, "扣减后 quota_used=6");
  assert.equal(consumed.quotaTotal, 12, "quota_total=12");
  const m1Row = store.members.find((m) => m.id === "m1")!;
  assert.equal(m1Row.quota_used, 6, "落库 quota_used=6");

  // 2) 超配额拒绝（品牌管家满 12 条）——学生路径提示语
  m1Row.quota_used = 12;
  const exhausted = await checkMemberQuota(db, "m1", BASE_NOW);
  assert.equal(exhausted.allowed, false, "满配额拒绝");
  assert.equal(exhausted.reason, "exhausted", "原因 exhausted");
  assert.equal(exhausted.needUpgrade, true, "提示升级");
  assert.equal(exhausted.message, "本月配额已用完，请联系升级品牌管家", "明确提示语");

  // 3) 免费客户满配额：既有提示语不退化
  const m2Row = store.members.find((m) => m.id === "m2")!;
  m2Row.quota_used = 2;
  const freeExhausted = await checkMemberQuota(db, "m2", BASE_NOW);
  assert.equal(freeExhausted.allowed, false, "免费满配额拒绝");
  assert.equal(freeExhausted.message, "免费体验已用完，开通会员¥199/月", "免费提示语");

  // 4) 无订阅记录（老数据）回退 members 配额
  const legacy = await checkMemberQuota(db, "m3", BASE_NOW);
  assert.equal(legacy.allowed, true, "m3 无订阅记录但配额未满 → 允许");
  assert.equal(legacy.subscription, null, "无订阅记录");

  // 5) 付款审核通过 → 按项目激活订阅（mark-paid 调用路径）
  const activated = await activateSubscriptionForProject(db, "proj-pay", "admin-1", BASE_NOW);
  assert.equal(activated.memberId, "m2", "反查到客户 m2");
  assert.equal(activated.subscription.status, "active", "订阅 active");
  assert.equal(activated.subscription.memberId, "m2", "订阅归属 m2");
  assert.equal(activated.subscription.sourceProjectId, "proj-pay", "记录来源项目");
  assert.equal(activated.subscription.periodEnd, daysAfter(BASE_NOW.toISOString(), 30), "生效期结束 = 激活 + 30 天");
  assert.equal(m2Row.plan, "manager", "members.plan 自动置 manager（不再人工改）");
  assert.equal(m2Row.quota_total, 12, "quota_total=12");
  assert.equal(m2Row.quota_used, 0, "激活重置 quota_used=0");

  // 6) 生效期内续费：周期顺延 30 天 + 重置配额
  m2Row.quota_used = 7;
  const renewed = await activateSubscriptionForProject(db, "proj-pay", "admin-1", new Date("2026-08-25T00:00:00.000Z"));
  assert.equal(renewed.subscription.status, "active", "续费后 active");
  assert.equal(
    renewed.subscription.periodEnd,
    daysAfter("2026-09-21T00:00:00.000Z", 30),
    "生效期内续费：周期从原结束点顺延 30 天",
  );
  assert.equal(m2Row.quota_used, 0, "续费重置配额 quota_used=0");
  assert.equal(m2Row.quota_total, 12, "续费保持 quota_total=12");

  // 7) 到期：周期到点 → 惰性置 expired → 生成路径拒绝
  const expiredCheck = await checkMemberQuota(db, "m4", BASE_NOW);
  assert.equal(expiredCheck.allowed, false, "到期拒绝");
  assert.equal(expiredCheck.reason, "expired", "原因 expired");
  assert.equal(expiredCheck.message, "品牌管家已到期，请续费", "到期提示语");
  assert.equal(expiredCheck.needUpgrade, true, "到期提示升级");
  const m4SubRow = store.brand_steward_subscriptions.find((s) => s.member_id === "m4")!;
  assert.equal(m4SubRow.status, "expired", "惰性同步已把订阅置 expired");
  const synced = await syncSubscriptionPeriod(db, "m4", BASE_NOW);
  assert.equal(synced?.status, "expired", "重复同步幂等（仍 expired）");

  // 8) 到期后续费：重开周期（从当前时刻起 30 天）+ 重置配额
  const renewedAfterExpiry = await activateSubscriptionForMember(db, "m4", "proj-new", "admin-1", BASE_NOW);
  assert.equal(renewedAfterExpiry.subscription.status, "active", "续费后重新 active");
  assert.equal(renewedAfterExpiry.subscription.periodEnd, daysAfter(BASE_NOW.toISOString(), 30), "重开周期 = 当前 + 30 天");
  const m4Row = store.members.find((m) => m.id === "m4")!;
  assert.equal(m4Row.quota_used, 0, "续费重置 quota_used=0");
  assert.equal(m4Row.quota_total, 12, "续费 quota_total=12");

  // 9) 暂停：active → paused → 生成路径拒绝
  const paused = await pauseSubscription(db, "m4", "admin-1", BASE_NOW);
  assert.equal(paused.status, "paused", "暂停后 paused");
  assert.ok(paused.pausedAt, "记录暂停时间");
  const pausedCheck = await checkMemberQuota(db, "m4", BASE_NOW);
  assert.equal(pausedCheck.allowed, false, "暂停拒绝");
  assert.equal(pausedCheck.reason, "paused", "原因 paused");
  assert.equal(pausedCheck.message, "品牌管家服务已暂停，请联系客服", "暂停提示语");
  // 暂停幂等
  const pausedAgain = await pauseSubscription(db, "m4", "admin-1", BASE_NOW);
  assert.equal(pausedAgain.status, "paused", "重复暂停幂等");

  // 10) 恢复：paused → active → 允许生成
  const resumed = await resumeSubscription(db, "m4", "admin-1", BASE_NOW);
  assert.equal(resumed.status, "active", "恢复后 active");
  const resumedCheck = await checkMemberQuota(db, "m4", BASE_NOW);
  assert.equal(resumedCheck.allowed, true, "恢复后允许生成");

  // 11) 边界：无订阅暂停/恢复 → 404；已到期暂停 → 409；已到期恢复 → 409
  await expectError(pauseSubscription(db, "m3", "admin-1", BASE_NOW), 404, /没有品牌管家订阅/);
  await expectError(resumeSubscription(db, "m3", "admin-1", BASE_NOW), 404, /没有品牌管家订阅/);
  store.brand_steward_subscriptions.find((s) => s.member_id === "m4")!.status = "expired";
  await expectError(pauseSubscription(db, "m4", "admin-1", BASE_NOW), 409, /已到期/);
  await expectError(resumeSubscription(db, "m4", "admin-1", BASE_NOW), 409, /已到期/);

  // 12) getSubscription 对外返回（member/me 用）
  const subView = await getSubscription(db, "m1", BASE_NOW);
  assert.equal(subView?.memberId, "m1", "me 返回订阅");
  assert.equal(subView?.periodEnd, "2026-08-31T00:00:00.000Z", "me 返回周期结束（到期提醒数据）");

  console.log("TICKET-122-R23 quota-subscription regression: ALL ASSERTIONS PASSED");

  // 13) API 路由接线断言
  const studentGenerate = readFileSync("src/app/api/admin/student-generate/route.ts", "utf8");
  assert.match(studentGenerate, /checkMemberQuota\(supabaseAdmin, content\.member_id\)/, "学生路径生成前检查配额");
  assert.match(studentGenerate, /consumeMemberQuota\(supabaseAdmin, content\.member_id\)/, "学生路径成功扣减配额");
  assert.match(studentGenerate, /quota\.message/, "学生路径返回配额拒绝提示");
  assert.match(studentGenerate, /needUpgrade/, "学生路径返回升级标记");

  const memberGenerate = readFileSync("src/app/api/member/generate/route.ts", "utf8");
  assert.match(memberGenerate, /checkMemberQuota\(supabaseAdmin, member\.id\)/, "member/generate 走订阅感知检查");
  assert.match(memberGenerate, /consumeMemberQuota\(supabaseAdmin, member\.id\)/, "member/generate 走服务层扣减");

  const memberUpload = readFileSync("src/app/api/member/upload/route.ts", "utf8");
  assert.match(memberUpload, /checkMemberQuota\(supabaseAdmin, member\.id\)/, "member/upload 走订阅感知检查");
  assert.match(memberUpload, /consumeMemberQuota\(supabaseAdmin, member\.id\)/, "member/upload 走服务层扣减");

  const markPaid = readFileSync("src/app/api/admin/mark-paid/route.ts", "utf8");
  assert.match(markPaid, /activateSubscriptionForProject\(supabaseAdmin, projectId, session\.userId\)/, "mark-paid 激活订阅");
  assert.match(markPaid, /SUBSCRIPTION_RULES\.plan/, "mark-paid 按档位判断是否品牌管家");
  assert.match(markPaid, /paidPlan/, "mark-paid 读取付款档位");

  const uploadScreenshot = readFileSync("src/app/api/payment/upload-screenshot/route.ts", "utf8");
  assert.match(uploadScreenshot, /paidPlan/, "upload-screenshot 记录购买档位");
  assert.match(uploadScreenshot, /formData\.get\("plan"\)/, "upload-screenshot 接收 plan");

  const confirmPage = readFileSync("src/app/(client)/confirm/page.tsx", "utf8");
  assert.match(confirmPage, /formData\.append\("plan", plan\)/, "confirm 页随截图提交 plan");

  const memberMe = readFileSync("src/app/api/member/me/route.ts", "utf8");
  assert.match(memberMe, /getSubscription\(supabaseAdmin, member\.id\)/, "member/me 返回订阅状态");

  const subscriptionsRoute = readFileSync("src/app/api/admin/subscriptions/route.ts", "utf8");
  assert.match(subscriptionsRoute, /verifyAdminSession/, "订阅管理 API 会话门禁");
  assert.match(subscriptionsRoute, /session\?\.role !== "admin"/, "订阅管理仅管理员");
  assert.match(subscriptionsRoute, /activateSubscriptionForProject\(supabaseAdmin, String\(projectId\)/, "订阅管理激活");
  assert.match(subscriptionsRoute, /pauseSubscription\(supabaseAdmin, String\(memberId\)/, "订阅管理暂停");
  assert.match(subscriptionsRoute, /resumeSubscription\(supabaseAdmin, String\(memberId\)/, "订阅管理恢复");

  // 14) 迁移文件存在且含订阅表结构
  const migrationPath = "supabase/migrations/20260822_brand_steward_subscription_closed_loop.sql";
  assert.ok(existsSync(migrationPath), "订阅迁移文件存在");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /brand_steward_subscriptions/, "迁移建订阅表");
  assert.match(migration, /status text NOT NULL DEFAULT 'active'/, "迁移状态字段");
  assert.match(migration, /CHECK \(status IN \('active', 'expired', 'paused'\)\)/, "迁移状态取值");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
