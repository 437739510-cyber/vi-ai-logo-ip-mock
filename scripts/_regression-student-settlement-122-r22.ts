// TICKET-122-R22 结算闭环 本地离线回归（不连生产库）。
// 直接注入内存版 Supabase 客户端到结算服务层，验证：
//   1) 确认内容 → 生成待结算流水（比例正确：新手 72 / 银 78 / 金 83，金额正确）
//   2) 单价/提成从 site_config 读取（pricing standard=49 / commission 72/78/83），
//      回退 partner-config（basic=19 映射）
//   3) 非学生来源 / 未确认 / 非就绪 → 不生成流水
//   4) 幂等：同一 content_id 不重复生成，total_orders 不重复累计
//   5) 20/50 单升级：银级 78%、金级 83%，并回写 total_orders/level/commission_rate
//   6) 管理员打款：pending → paid（记录 paid_at/paid_by）；重复打款拒绝
//   7) 汇总与明细：getEarningsSummary + listSettlementsForStudent（学生名/客户名）
//   8) sync 回填：为已确认但无流水的内容生成
//   9) API 路由：会话门禁 + 调服务层（earnings / settlements / confirm-content）

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SETTLEMENT_RULES,
  resolveTier,
  resolveUnitPriceForPlan,
  loadCommissionConfig,
  loadSettlementRules,
  generateSettlementForConfirmedContent,
  syncSettlementsForConfirmedContents,
  listSettlementsForStudent,
  listAllSettlements,
  markSettlementPaid,
  getEarningsSummary,
  currentStudentTier,
  SettlementError,
} from "../src/lib/student-settlement";
import { PARTNER_CONFIG } from "../src/lib/core/partner-config";

type Row = Record<string, any>;
type TableMap = Record<string, Row[]>;

class MockQuery {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string | null = null;
  private where: Array<["eq" | "neq" | "in", string, any]> = [];
  private orderBy: [string, { ascending?: boolean }] | null = null;
  private payload: Row | Row[] | null = null;
  private singleFlag = false;

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
    site_config: [
      {
        key: "pricing",
        value: {
          basic: { price: "19" },
          standard: { price: "49" },
          manager: { price: "199" },
        },
      },
      {
        key: "commission",
        value: {
          base: 72,
          silver: 78,
          gold: 83,
          upgradeOrders: { silver: 20, gold: 50 },
        },
      },
    ],
    student_accounts: [
      { id: "s_new", name: "小明", phone: "13900000001", level: "", total_orders: 0, commission_rate: 72, created_at: "2026-08-22T01:00:00.000Z" },
      { id: "s_silver", name: "小红", phone: "13900000002", level: "", total_orders: 19, commission_rate: 72, created_at: "2026-08-22T02:00:00.000Z" },
      { id: "s_gold", name: "小刚", phone: "13900000003", level: "", total_orders: 49, commission_rate: 72, created_at: "2026-08-22T03:00:00.000Z" },
      { id: "s_basic", name: "小美", phone: "13900000004", level: "", total_orders: 0, commission_rate: 72, created_at: "2026-08-22T04:00:00.000Z" },
    ],
    members: [
      { id: "m1", phone: "13800000001", name: "老王", plan: "standard", quota_used: 0, quota_total: 10, created_at: "2026-08-22T05:00:00.000Z" },
      { id: "m2", phone: "13800000002", name: "老李", plan: "basic", quota_used: 0, quota_total: 10, created_at: "2026-08-22T06:00:00.000Z" },
      { id: "m3", phone: "13800000003", name: "老张", plan: "free", quota_used: 0, quota_total: 10, created_at: "2026-08-22T07:00:00.000Z" },
    ],
    submissions: [
      { id: "sub1", phone: "13800000001", company_name: "老王面馆", client_name: "老王", status: "submitted", student_id: null, created_at: "2026-08-22T08:00:00.000Z", submitted_at: "2026-08-22T08:00:00.000Z" },
      { id: "sub2", phone: "13800000002", company_name: "老李火锅", client_name: "老李", status: "submitted", student_id: null, created_at: "2026-08-22T09:00:00.000Z", submitted_at: "2026-08-22T09:00:00.000Z" },
    ],
    member_contents: [
      // 有效订单：已确认 + 就绪 + 学生来源 → 生成待结算流水（新手 72%）
      { id: "c_ok", member_id: "m1", student_id: "s_new", images: [], note: "", caption: "✍️ 老王面馆", status: "ready", confirmed: true, source: "student", platform: "xiaohongshu", created_at: "2026-08-22T10:00:00.000Z" },
      // 未就绪（已确认但 status=pending）→ 不生成
      { id: "c_notready", member_id: "m1", student_id: "s_new", images: [], note: "", caption: "", status: "pending", confirmed: true, source: "student", platform: "wechat", created_at: "2026-08-22T10:10:00.000Z" },
      // 未确认 → 不生成
      { id: "c_notconfirmed", member_id: "m1", student_id: "s_new", images: [], note: "", caption: "", status: "ready", confirmed: false, source: "student", platform: "douyin", created_at: "2026-08-22T10:20:00.000Z" },
      // 非学生来源（客户自建）→ 不生成
      { id: "c_self", member_id: "m1", student_id: "", images: [], note: "", caption: "", status: "ready", confirmed: true, source: "self", platform: "xiaohongshu", created_at: "2026-08-22T10:30:00.000Z" },
      // 银级升级边界：s_silver 已有 19 单，确认本单 → 20 单 → 银级 78%
      { id: "c_silver", member_id: "m1", student_id: "s_silver", images: [], note: "", caption: "", status: "ready", confirmed: true, source: "student", platform: "xiaohongshu", created_at: "2026-08-22T10:40:00.000Z" },
      // 金级升级边界：s_gold 已有 49 单，确认本单 → 50 单 → 金级 83%
      { id: "c_gold", member_id: "m1", student_id: "s_gold", images: [], note: "", caption: "", status: "ready", confirmed: true, source: "student", platform: "xiaohongshu", created_at: "2026-08-22T10:50:00.000Z" },
      // basic 套餐单价：s_basic 服务 m2（plan=basic）→ unitPrice=49
      { id: "c_basic", member_id: "m2", student_id: "s_basic", images: [], note: "", caption: "", status: "ready", confirmed: true, source: "student", platform: "xiaohongshu", created_at: "2026-08-22T11:00:00.000Z" },
    ],
    settlements: [],
  };
}

async function expectError(promise: Promise<unknown>, status: number, msg: RegExp): Promise<void> {
  await assert.rejects(
    () => promise,
    (e: unknown) => e instanceof SettlementError && (e as SettlementError).status === status && msg.test((e as Error).message),
    `期望被拒（${status}）`,
  );
}

async function main() {
  const store = seed();
  const db = new MockSupabase(store) as any;

  // 0) 纯函数：等级比例
  assert.equal(resolveTier(0).ratio, 72, "0 单 → 新手 72%");
  assert.equal(resolveTier(19).ratio, 72, "19 单 → 新手 72%");
  assert.equal(resolveTier(20).ratio, 78, "20 单 → 银级 78%");
  assert.equal(resolveTier(49).ratio, 78, "49 单 → 银级 78%");
  assert.equal(resolveTier(50).ratio, 83, "50 单 → 金级 83%");
  assert.equal(resolveTier(200).ratio, 83, "200 单 → 金级 83%");

  // 单价映射：standard=49（site_config），basic=19，manager=199
  const pricing = { basic: { price: "19" }, standard: { price: "49" }, manager: { price: "199" } };
  assert.equal(resolveUnitPriceForPlan("standard", pricing), 49, "standard 单价 49");
  assert.equal(resolveUnitPriceForPlan("basic", pricing), 19, "basic 单价 19");
  assert.equal(resolveUnitPriceForPlan("free", pricing), 49, "free 回退标准价 49");
  assert.equal(resolveUnitPriceForPlan("manager", pricing), 199, "manager 单价 199");

  // 提成配置：site_config「commission」优先，回退 partner-config
  const scCommission = await loadCommissionConfig(db);
  assert.deepEqual(
    { base: scCommission.base, silver: scCommission.silver, gold: scCommission.gold, s: scCommission.upgradeOrders.silver, g: scCommission.upgradeOrders.gold },
    { base: 72, silver: 78, gold: 83, s: 20, g: 50 },
    "site_config commission 读取正确（72/78/83，20/50）",
  );
  const siteConfigBackup = store.site_config;
  store.site_config = [];
  const fbCommission = await loadCommissionConfig(db);
  assert.deepEqual(
    { base: fbCommission.base, silver: fbCommission.silver, gold: fbCommission.gold, s: fbCommission.upgradeOrders.silver, g: fbCommission.upgradeOrders.gold },
    { base: 72, silver: 78, gold: 83, s: 20, g: 50 },
    "无 site_config commission 时回退 partner-config（72/78/83，20/50）",
  );
  store.site_config = siteConfigBackup;
  const rules = await loadSettlementRules(db);
  assert.equal(rules.base.ratio, 72, "规则快照新手 72%");
  assert.equal(rules.silver.ratio, 78, "规则快照银级 78%");
  assert.equal(rules.gold.ratio, 83, "规则快照金级 83%");
  assert.equal(rules.silverOrders, 20, "规则快照银级 20 单");
  assert.equal(rules.goldOrders, 50, "规则快照金级 50 单");

  // 自定义提成配置覆盖（结算服务层应消费 site_config commission）
  const custom = { base: 70, silver: 75, gold: 80, upgradeOrders: { silver: 20, gold: 50 } };
  assert.equal(resolveTier(0, custom).ratio, 70, "自定义配置新手 70%");
  assert.equal(resolveTier(20, custom).ratio, 75, "自定义配置银级 75%");
  assert.equal(resolveTier(50, custom).ratio, 80, "自定义配置金级 80%");

  // 1) 确认内容 → 生成待结算流水（新手 72%）
  const okResult = await generateSettlementForConfirmedContent(db, "c_ok");
  assert.equal(okResult.created, true, "c_ok 生成流水");
  const okRecord = okResult.record!;
  assert.equal(okRecord.unitPrice, 49, "单价来自 site_config standard=49");
  assert.equal(okRecord.studentRatio, 72, "学生比例 72%");
  assert.equal(okRecord.platformRatio, 28, "平台比例 28%");
  assert.equal(okRecord.studentAmount, 35.28, "学生金额 49*0.72 = 35.28");
  assert.equal(okRecord.platformAmount, 13.72, "平台金额 49*0.28 = 13.72");
  assert.equal(okRecord.totalAmount, 49, "总额 49");
  assert.equal(okRecord.tier, "base", "新手等级");
  assert.equal(okRecord.status, "pending", "初始待结算");
  assert.ok(okRecord.settledAt, "记录结算时间");

  // 累计 + 等级回写
  const sNew = store.student_accounts.find((s) => s.id === "s_new")!;
  assert.equal(sNew.total_orders, 1, "total_orders 累计到 1");
  assert.equal(sNew.commission_rate, 72, "commission_rate 同步 72%");
  assert.equal(sNew.level, "新手合伙人", "level 同步新手合伙人");

  // 2) 幂等：同一内容不重复生成
  const again = await generateSettlementForConfirmedContent(db, "c_ok");
  assert.equal(again.created, false, "重复调用不生成");
  assert.equal(again.already, true, "重复调用标记 already");
  const sNewAfter = store.student_accounts.find((s) => s.id === "s_new")!;
  assert.equal(sNewAfter.total_orders, 1, "total_orders 不重复累计");

  // 3) 非有效订单不生成
  assert.equal((await generateSettlementForConfirmedContent(db, "c_notready")).created, false, "未就绪不生成");
  assert.equal((await generateSettlementForConfirmedContent(db, "c_notconfirmed")).created, false, "未确认不生成");
  assert.equal((await generateSettlementForConfirmedContent(db, "c_self")).created, false, "非学生来源不生成");

  // 4) 20 单升级银级 78%
  const silverResult = await generateSettlementForConfirmedContent(db, "c_silver");
  assert.equal(silverResult.created, true, "c_silver 生成流水");
  assert.equal(silverResult.record!.studentRatio, 78, "第 20 单 → 银级 78%");
  assert.equal(silverResult.record!.platformRatio, 22, "平台 22%");
  assert.equal(silverResult.record!.studentAmount, 38.22, "49*0.78 = 38.22");
  assert.equal(silverResult.record!.platformAmount, 10.78, "49*0.22 = 10.78");
  assert.equal(silverResult.record!.tier, "silver", "银级等级");
  const sSilver = store.student_accounts.find((s) => s.id === "s_silver")!;
  assert.equal(sSilver.total_orders, 20, "20 单累计");
  assert.equal(sSilver.commission_rate, 78, "commission_rate 同步 78%");
  assert.equal(sSilver.level, "银级合伙人", "level 同步银级");

  // 5) 50 单升级金级 83%
  const goldResult = await generateSettlementForConfirmedContent(db, "c_gold");
  assert.equal(goldResult.created, true, "c_gold 生成流水");
  assert.equal(goldResult.record!.studentRatio, 83, "第 50 单 → 金级 83%");
  assert.equal(goldResult.record!.platformRatio, 17, "平台 17%");
  assert.equal(goldResult.record!.studentAmount, 40.67, "49*0.83 = 40.67");
  assert.equal(goldResult.record!.platformAmount, 8.33, "49*0.17 = 8.33");
  assert.equal(goldResult.record!.tier, "gold", "金级等级");
  const sGold = store.student_accounts.find((s) => s.id === "s_gold")!;
  assert.equal(sGold.total_orders, 50, "50 单累计");
  assert.equal(sGold.commission_rate, 83, "commission_rate 同步 83%");
  assert.equal(sGold.level, "金级合伙人", "level 同步金级");

  // 6) basic 套餐单价 19（site_config 定价）
  const basicResult = await generateSettlementForConfirmedContent(db, "c_basic");
  assert.equal(basicResult.created, true, "c_basic 生成流水");
  assert.equal(basicResult.record!.unitPrice, 19, "basic 套餐单价 19");
  assert.equal(basicResult.record!.studentAmount, 13.68, "19*0.72 = 13.68");

  // 7) 打款状态机：pending → paid
  const paid = await markSettlementPaid(db, "SST-c_ok", "admin-1");
  assert.equal(paid.status, "paid", "打款后已到账");
  assert.equal(paid.paidBy, "admin-1", "记录操作人");
  assert.ok(paid.paidAt, "记录打款时间");
  const okRow = store.settlements.find((s) => s.content_id === "c_ok")!;
  assert.equal(okRow.status, "paid", "落库 status=paid");
  assert.equal(okRow.paid_by, "admin-1", "落库操作人");
  assert.ok(okRow.paid_at, "落库打款时间");

  // 重复打款拒绝
  await expectError(markSettlementPaid(db, "SST-c_ok", "admin-1"), 409, /已到账/);

  // 8) 汇总与明细
  const sNewRecords = await listSettlementsForStudent(db, "s_new");
  assert.equal(sNewRecords.length, 1, "s_new 有 1 条流水");
  assert.equal(sNewRecords[0].studentName, "小明", "流水带学生名");
  assert.equal(sNewRecords[0].brandName, "老王面馆", "流水带客户名（来自 submission.company_name）");
  assert.equal(getEarningsSummary(sNewRecords).totalEarned, 35.28, "累计收入 = 35.28");
  assert.equal(getEarningsSummary(sNewRecords).paidAmount, 35.28, "已到账 = 35.28（已打款）");
  assert.equal(getEarningsSummary(sNewRecords).pendingAmount, 0, "待结算 = 0");
  assert.equal(getEarningsSummary(sNewRecords).orderCount, 1, "订单数 = 1");

  // 管理员全量
  const all = await listAllSettlements(db);
  assert.equal(all.length, 4, "全量流水 4 条（c_ok/c_silver/c_gold/c_basic）");
  const pendingOnly = await listAllSettlements(db, { status: "pending" });
  assert.equal(pendingOnly.length, 3, "待结算 3 条（c_ok 已打款）");

  // 9) sync 回填：新确认内容（无流水）→ 生成
  store.member_contents.push({
    id: "c_sync",
    member_id: "m3",
    student_id: "s_new",
    images: [],
    note: "",
    caption: "",
    status: "ready",
    confirmed: true,
    source: "student",
    platform: "wechat",
    created_at: "2026-08-22T12:00:00.000Z",
  });
  const syncResult = await syncSettlementsForConfirmedContents(db);
  assert.equal(syncResult.created, 1, "sync 生成 1 条");
  assert.equal(syncResult.skipped, 4, "其余 4 条已有流水（含幂等）");
  const sNewAfterSync = store.student_accounts.find((s) => s.id === "s_new")!;
  assert.equal(sNewAfterSync.total_orders, 2, "sync 后 total_orders 累计到 2");

  // 10) 当前等级（按累计单数）
  assert.equal((await currentStudentTier(db, "s_new")).ratio, 72, "s_new 当前 72%（2 单）");
  assert.equal((await currentStudentTier(db, "s_silver")).ratio, 78, "s_silver 当前 78%");
  assert.equal((await currentStudentTier(db, "s_gold")).ratio, 83, "s_gold 当前 83%");
  assert.equal((await currentStudentTier(db, "s_unknown")).ratio, 72, "未知学生回退 72%");

  // 11) R24 规则常量
  assert.equal(SETTLEMENT_RULES.base.ratio, 72, "R24 新手 72%");
  assert.equal(SETTLEMENT_RULES.silver.ratio, 78, "R24 银级 78%");
  assert.equal(SETTLEMENT_RULES.gold.ratio, 83, "R24 金级 83%");
  assert.equal(SETTLEMENT_RULES.silverOrders, 20, "20 单升银级");
  assert.equal(SETTLEMENT_RULES.goldOrders, 50, "50 单升金级");

  // 12) R24 回退配置口径：partner-config 与 site_config 默认一致
  assert.equal(PARTNER_CONFIG.pricing.basic, 19, "partner-config 基础版 ¥19");
  assert.equal(PARTNER_CONFIG.pricing.standard, 49, "partner-config 标准版 ¥49");
  assert.equal(PARTNER_CONFIG.pricing.premium, 199, "partner-config 品牌管家 ¥199/月");
  assert.equal(PARTNER_CONFIG.commission.base, 72, "partner-config 新手 72%");
  assert.equal(PARTNER_CONFIG.commission.silver, 78, "partner-config 银级 78%");
  assert.equal(PARTNER_CONFIG.commission.gold, 83, "partner-config 金级 83%");
  assert.equal(PARTNER_CONFIG.commission.upgradeOrders.silver, 20, "partner-config 银级 20 单");
  assert.equal(PARTNER_CONFIG.commission.upgradeOrders.gold, 50, "partner-config 金级 50 单");

  const partnerPageSrc = readFileSync("src/app/(client)/partner/page.tsx", "utf8");
  assert.match(partnerPageSrc, /\/api\/config\/pricing/, "partner 页动态读取 site_config 定价/提成");
  assert.match(partnerPageSrc, /提成阶梯/, "partner 页展示提成阶梯（含等级说明）");

  console.log("TICKET-122-R22 student-settlement regression: ALL ASSERTIONS PASSED");

  // 12) API 路由：会话门禁 + 调服务层
  const earningsRoute = readFileSync("src/app/api/admin/earnings/route.ts", "utf8");
  assert.match(earningsRoute, /verifyAdminSession/, "earnings 路由使用会话校验");
  assert.match(earningsRoute, /session\?\.role !== "student"/, "earnings 仅大学生");
  assert.match(earningsRoute, /listSettlementsForStudent\(supabaseAdmin, userId/, "earnings 调服务层");
  assert.match(earningsRoute, /getEarningsSummary\(records\)/, "earnings 汇总");
  assert.match(earningsRoute, /currentStudentTier\(supabaseAdmin, userId\)/, "earnings 返回等级");

  const settlementsRoute = readFileSync("src/app/api/admin/settlements/route.ts", "utf8");
  assert.match(settlementsRoute, /session\?\.role !== "admin"/, "settlements 仅管理员");
  assert.match(settlementsRoute, /markSettlementPaid\(supabaseAdmin,/, "settlements 打款调服务层");
  assert.match(settlementsRoute, /syncSettlementsForConfirmedContents\(supabaseAdmin\)/, "settlements 回填调服务层");
  assert.match(settlementsRoute, /listAllSettlements\(supabaseAdmin,/, "settlements 列表调服务层");

  const confirmRoute = readFileSync("src/app/api/member/confirm-content/route.ts", "utf8");
  assert.match(confirmRoute, /generateSettlementForConfirmedContent\(supabaseAdmin, contentId\)/, "确认事件调结算服务层");

  const earningsPage = readFileSync("src/app/admin/earnings/page.tsx", "utf8");
  assert.match(earningsPage, /api\/admin\/earnings/, "earnings 页读取真实流水 API");
  assert.doesNotMatch(earningsPage, /模拟收入数据/, "earnings 页不再使用模拟数据");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
