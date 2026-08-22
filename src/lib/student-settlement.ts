// TICKET-122-R22：结算闭环（GAP-E）——真实提成，学生拿大头。
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端，便于离线 mock 回归验证。
//
// 商业模式（Chris 2026-08-22 确认）：平台无线下触角，学生获客服务；
// 收益学生拿大头、平台拿小头，分成适用所有产品线（含 VI 与 VI+IP 手册）。
//
// 提成口径（R24 起统一真源 = site_config「commission」，本常量仅作回退兜底）：
//   新手 72% → 银级 78%（累计已确认 20 单）→ 金级 83%（累计已确认 50 单）；
//   平台 28/22/17%。
// 单价的取值来源：site_config「pricing」优先，回退 partner-config。

import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_CONFIG } from "./core/partner-config";

type Db = SupabaseClient;

export type SettlementStatus = "pending" | "paid";
export type StudentTier = "base" | "silver" | "gold";

export class SettlementError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SettlementError";
    this.status = status;
  }
}

/** R24 统一提成口径（交接文档）。 */
export const SETTLEMENT_RULES = {
  base: { ratio: 72, level: "新手合伙人", tier: "base" as StudentTier },
  silver: { ratio: 78, level: "银级合伙人", tier: "silver" as StudentTier },
  gold: { ratio: 83, level: "金级合伙人", tier: "gold" as StudentTier },
  silverOrders: 20,
  goldOrders: 50,
} as const;

export interface SettlementRecord {
  id: string;
  contentId: string;
  memberId: string;
  studentId: string;
  studentName?: string;
  brandName?: string;
  unitPrice: number;
  studentRatio: number;
  platformRatio: number;
  studentAmount: number;
  platformAmount: number;
  totalAmount: number;
  studentLevel: string;
  tier: StudentTier;
  status: SettlementStatus;
  settledAt: string;
  paidAt?: string | null;
  paidBy?: string | null;
}

export interface EarningsSummary {
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  orderCount: number;
}

export interface SettlementHydrate {
  studentName?: string;
  brandName?: string;
}

interface PricingTier {
  price?: string | number;
}

interface PricingSource {
  basic?: PricingTier;
  standard?: PricingTier;
  manager?: PricingTier;
  premium?: PricingTier;
}

/** 提成配置（site_config「commission」优先，partner-config 回退）。 */
export interface CommissionConfig {
  base: number;
  silver: number;
  gold: number;
  upgradeOrders: { silver: number; gold: number };
}

/** 收益展示用的规则快照（earnings API / 合伙人页共用口径）。 */
export interface SettlementRules {
  base: { ratio: number; level: string };
  silver: { ratio: number; level: string };
  gold: { ratio: number; level: string };
  silverOrders: number;
  goldOrders: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ---------------------------------------------------------------------------
// 等级 / 比例 / 单价
// ---------------------------------------------------------------------------

function defaultCommissionConfig(): CommissionConfig {
  return {
    base: PARTNER_CONFIG.commission.base,
    silver: PARTNER_CONFIG.commission.silver,
    gold: PARTNER_CONFIG.commission.gold,
    upgradeOrders: { ...PARTNER_CONFIG.commission.upgradeOrders },
  };
}

/** 读取提成配置：site_config「commission」优先，回退 partner-config。 */
export async function loadCommissionConfig(db: Db): Promise<CommissionConfig> {
  try {
    const { data } = await db.from("site_config").select("key, value").eq("key", "commission").single();
    const value = asRecord(data?.value);
    const base = Number(value.base);
    const silver = Number(value.silver);
    const gold = Number(value.gold);
    if (Number.isFinite(base) && Number.isFinite(silver) && Number.isFinite(gold)) {
      const upgrade = asRecord(value.upgradeOrders);
      const silverOrders = Number(upgrade.silver);
      const goldOrders = Number(upgrade.gold);
      return {
        base,
        silver,
        gold,
        upgradeOrders: {
          silver: Number.isFinite(silverOrders) ? silverOrders : PARTNER_CONFIG.commission.upgradeOrders.silver,
          gold: Number.isFinite(goldOrders) ? goldOrders : PARTNER_CONFIG.commission.upgradeOrders.gold,
        },
      };
    }
  } catch {
    // 无配置则回退 partner-config
  }
  return defaultCommissionConfig();
}

/** 收益展示规则快照：site_config「commission」→ partner-config 回退。 */
export async function loadSettlementRules(db: Db): Promise<SettlementRules> {
  const cfg = await loadCommissionConfig(db);
  return {
    base: { ratio: cfg.base, level: SETTLEMENT_RULES.base.level },
    silver: { ratio: cfg.silver, level: SETTLEMENT_RULES.silver.level },
    gold: { ratio: cfg.gold, level: SETTLEMENT_RULES.gold.level },
    silverOrders: cfg.upgradeOrders.silver,
    goldOrders: cfg.upgradeOrders.gold,
  };
}

/** 由累计已确认单数决定学生等级与提成比例（20 -> 银 78%，50 -> 金 83%）。 */
export function resolveTier(count: number, commission?: CommissionConfig): { tier: StudentTier; ratio: number; level: string } {
  const cfg = commission ?? defaultCommissionConfig();
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n >= cfg.upgradeOrders.gold) {
    return { tier: "gold", ratio: cfg.gold, level: SETTLEMENT_RULES.gold.level };
  }
  if (n >= cfg.upgradeOrders.silver) {
    return { tier: "silver", ratio: cfg.silver, level: SETTLEMENT_RULES.silver.level };
  }
  return { tier: "base", ratio: cfg.base, level: SETTLEMENT_RULES.base.level };
}

function priceOf(tier?: PricingTier): number {
  if (!tier) return 0;
  const raw = tier.price;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 单价取值来源：site_config「pricing」优先，回退 partner-config。
 * 客户套餐（members.plan）→ 定价档位；
 * 无法解析（free / 未知 / standard）时回退到「标准版」单价，作为确定性默认。
 */
export function resolveUnitPriceForPlan(plan: string | null | undefined, pricing: PricingSource): number {
  const p = (plan || "").trim().toLowerCase();
  if (p === "basic") return priceOf(pricing.basic) || priceOf(pricing.standard) || priceOf(pricing.premium);
  if (p === "manager" || p === "premium") {
    return priceOf(pricing.manager) || priceOf(pricing.premium) || priceOf(pricing.standard) || priceOf(pricing.basic);
  }
  return priceOf(pricing.standard) || priceOf(pricing.basic) || priceOf(pricing.premium);
}

/** 读取定价配置：site_config(值优先) → partner-config(回退)。 */
export async function loadPricingConfig(db: Db): Promise<PricingSource> {
  try {
    const { data } = await db.from("site_config").select("key, value").eq("key", "pricing").single();
    const value = asRecord(data?.value);
    if (value && Object.keys(value).length > 0) {
      return value as PricingSource;
    }
  } catch {
    // 无配置则回退 partner-config
  }
  return {
    basic: { price: PARTNER_CONFIG.pricing.basic },
    standard: { price: PARTNER_CONFIG.pricing.standard },
    premium: { price: PARTNER_CONFIG.pricing.premium },
  };
}

// ---------------------------------------------------------------------------
// 结算记录归一化与补水（学生名 / 客户名）
// ---------------------------------------------------------------------------

function normalizeSettlement(row: Record<string, unknown>): SettlementRecord {
  return {
    id: String(row.id ?? ""),
    contentId: String(row.content_id ?? ""),
    memberId: String(row.member_id ?? ""),
    studentId: String(row.student_id ?? ""),
    unitPrice: Number(row.unit_price ?? 0),
    studentRatio: Number(row.student_ratio ?? 0),
    platformRatio: Number(row.platform_ratio ?? 0),
    studentAmount: Number(row.student_amount ?? 0),
    platformAmount: Number(row.platform_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    studentLevel: String(row.student_level ?? ""),
    tier: (row.tier as StudentTier) || "base",
    status: (row.status as SettlementStatus) || "pending",
    settledAt: String(row.settled_at ?? ""),
    paidAt: row.paid_at == null ? null : String(row.paid_at),
    paidBy: row.paid_by == null ? null : String(row.paid_by),
  };
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function hydrateSettlements(
  db: Db,
  rows: Array<Record<string, unknown>>,
  extra?: SettlementHydrate,
): Promise<SettlementRecord[]> {
  if (rows.length === 0) return [];

  const studentIds = unique(rows.map((r) => String(r.student_id ?? "")).filter(Boolean));
  const memberIds = unique(rows.map((r) => String(r.member_id ?? "")).filter(Boolean));

  let studentNameMap: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: accounts } = await db.from("student_accounts").select("id, name").in("id", studentIds);
    studentNameMap = Object.fromEntries(
      ((accounts ?? []) as Array<Record<string, unknown>>).map((a) => [String(a.id), String(a.name || "")]),
    );
  }

  let brandNameMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await db.from("members").select("id, name, phone").in("id", memberIds);
    const memberRows = ((members ?? []) as Array<Record<string, unknown>>);
    const phones = unique(memberRows.map((m) => String(m.phone ?? "")).filter(Boolean));
    let companyByPhone: Record<string, string> = {};
    if (phones.length > 0) {
      const { data: subs } = await db.from("submissions").select("phone, company_name").in("phone", phones);
      companyByPhone = Object.fromEntries(
        ((subs ?? []) as Array<Record<string, unknown>>).map((s) => [String(s.phone ?? ""), String(s.company_name ?? "")]),
      );
    }
    brandNameMap = Object.fromEntries(
      memberRows.map((m) => {
        const phone = String(m.phone ?? "");
        return [String(m.id), (phone && companyByPhone[phone]) || String(m.name ?? "")];
      }),
    );
  }

  return rows.map((r) => {
    const studentId = String(r.student_id ?? "");
    const memberId = String(r.member_id ?? "");
    return {
      ...normalizeSettlement(r),
      studentName: extra?.studentName || studentNameMap[studentId] || studentId,
      brandName: extra?.brandName || brandNameMap[memberId] || String(r.brand_name ?? "") || memberId,
    };
  });
}

// ---------------------------------------------------------------------------
// 确认事件：按「已确认内容/订单」生成待结算流水（幂等）+ 累计 + 等级升级
// ---------------------------------------------------------------------------

export interface GenerateResult {
  created: boolean;
  already?: boolean;
  record?: SettlementRecord;
}

export async function generateSettlementForConfirmedContent(db: Db, contentId: string): Promise<GenerateResult> {
  if (!contentId) throw new SettlementError("缺少内容 ID", 400);

  const { data: content, error: contentErr } = await db
    .from("member_contents")
    .select("id, member_id, student_id, source, status, confirmed, created_at")
    .eq("id", contentId)
    .single();
  if (contentErr || !content) throw new SettlementError("内容不存在", 404);
  const row = asRecord(content);

  // 仅「已确认 + 就绪 + 学生来源」构成有效订单，才生成待结算流水。
  if (row.confirmed !== true || row.status !== "ready" || row.source !== "student" || !row.student_id) {
    return { created: false };
  }

  const studentId = String(row.student_id);
  const memberId = String(row.member_id ?? "");

  // 幂等：同一内容已有流水则跳过（避免确认事件重复触发 / 重跑）。
  const { data: existingRows } = await db.from("settlements").select("id").eq("content_id", contentId);
  if (((existingRows ?? []) as Array<Record<string, unknown>>).length > 0) {
    return { created: false, already: true };
  }

  const { data: student, error: studentErr } = await db
    .from("student_accounts")
    .select("id, name, level, commission_rate, total_orders")
    .eq("id", studentId)
    .single();
  if (studentErr || !student) throw new SettlementError("学生账号不存在", 404);
  const studentRow = asRecord(student);

  const { data: member } = await db.from("members").select("id, name, plan").eq("id", memberId).single();
  const memberRow = asRecord(member);

  const [pricing, commission] = await Promise.all([
    loadPricingConfig(db),
    loadCommissionConfig(db),
  ]);
  const unitPrice = resolveUnitPriceForPlan(String(memberRow.plan ?? ""), pricing);

  // 累计已确认单数 + 1，按最新单数决定等级 → 新流水按新比例。
  const newCount = Math.max(0, Number(studentRow.total_orders) || 0) + 1;
  const tier = resolveTier(newCount, commission);
  const studentRatio = tier.ratio;
  const platformRatio = 100 - studentRatio;
  const studentAmount = round2((unitPrice * studentRatio) / 100);
  const platformAmount = round2((unitPrice * platformRatio) / 100);

  const isoNow = nowIso();
  const id = `SST-${contentId}`;
  const settlementRow: Record<string, unknown> = {
    id,
    content_id: contentId,
    member_id: memberId,
    student_id: studentId,
    unit_price: unitPrice,
    student_ratio: studentRatio,
    platform_ratio: platformRatio,
    student_amount: studentAmount,
    platform_amount: platformAmount,
    total_amount: unitPrice,
    student_level: tier.level,
    tier: tier.tier,
    status: "pending",
    settled_at: isoNow,
    created_at: isoNow,
  };
  const { error: insertErr } = await db.from("settlements").insert(settlementRow);
  if (insertErr) throw new SettlementError(insertErr.message, 500);

  // 确认事件累计 total_orders，并同步等级与提成比例（不再依赖人工改）。
  const { error: updateErr } = await db
    .from("student_accounts")
    .update({ total_orders: newCount, commission_rate: studentRatio, level: tier.level })
    .eq("id", studentId);
  if (updateErr) throw new SettlementError(updateErr.message, 500);

  return { created: true, record: normalizeSettlement(settlementRow) };
}

/** 管理员回填：为所有「已确认 + 就绪 + 学生来源」但尚无流水的内容生成待结算流水。 */
export async function syncSettlementsForConfirmedContents(db: Db): Promise<{ created: number; skipped: number }> {
  const { data, error } = await db
    .from("member_contents")
    .select("id")
    .eq("confirmed", true)
    .eq("status", "ready")
    .eq("source", "student");
  if (error) throw new SettlementError(error.message, 500);

  const ids = unique(((data ?? []) as Array<Record<string, unknown>>).map((r) => String(r.id)).filter(Boolean));
  let created = 0;
  let skipped = 0;
  for (const id of ids) {
    const res = await generateSettlementForConfirmedContent(db, id);
    if (res.created) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// 流水查询：学生自己 / 管理员全量
// ---------------------------------------------------------------------------

export async function listSettlementsForStudent(
  db: Db,
  studentId: string,
  status?: SettlementStatus,
): Promise<SettlementRecord[]> {
  let query = db.from("settlements").select("*").eq("student_id", studentId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("settled_at", { ascending: false });
  if (error) throw new SettlementError(error.message, 500);
  return hydrateSettlements(db, (data ?? []) as Array<Record<string, unknown>>);
}

export async function listAllSettlements(
  db: Db,
  filter?: { status?: SettlementStatus; studentId?: string },
): Promise<SettlementRecord[]> {
  let query = db.from("settlements").select("*");
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.studentId) query = query.eq("student_id", filter.studentId);
  const { data, error } = await query.order("settled_at", { ascending: false });
  if (error) throw new SettlementError(error.message, 500);
  return hydrateSettlements(db, (data ?? []) as Array<Record<string, unknown>>);
}

// ---------------------------------------------------------------------------
// 打款状态机：待结算(pending) → 管理员确认打款 → 已到账(paid)
// ---------------------------------------------------------------------------

export async function markSettlementPaid(db: Db, settlementId: string, operatorId: string): Promise<SettlementRecord> {
  if (!settlementId) throw new SettlementError("缺少结算记录 ID", 400);

  const { data: existing, error: readErr } = await db
    .from("settlements")
    .select("*")
    .eq("id", settlementId)
    .single();
  if (readErr || !existing) throw new SettlementError("结算记录不存在", 404);
  const row = asRecord(existing);
  if (row.status === "paid") throw new SettlementError("该流水已到账，请勿重复打款", 409);

  const isoNow = nowIso();
  const { data, error } = await db
    .from("settlements")
    .update({ status: "paid", paid_at: isoNow, paid_by: operatorId })
    .eq("id", settlementId)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw new SettlementError(error.message, 500);

  const updated = (data as Record<string, unknown>) || {
    ...row,
    status: "paid",
    paid_at: isoNow,
    paid_by: operatorId,
  };
  return normalizeSettlement(updated);
}

// ---------------------------------------------------------------------------
// 汇总（earnings 页）
// ---------------------------------------------------------------------------

export function getEarningsSummary(records: SettlementRecord[]): EarningsSummary {
  let totalEarned = 0;
  let pendingAmount = 0;
  let paidAmount = 0;
  for (const r of records) {
    totalEarned += r.studentAmount;
    if (r.status === "paid") paidAmount += r.studentAmount;
    else pendingAmount += r.studentAmount;
  }
  return {
    totalEarned: round2(totalEarned),
    pendingAmount: round2(pendingAmount),
    paidAmount: round2(paidAmount),
    orderCount: records.length,
  };
}

/** 学生当前等级（按累计已确认单数，无流水时按 base）。 */
export async function currentStudentTier(
  db: Db,
  studentId: string,
): Promise<{ tier: StudentTier; ratio: number; level: string }> {
  try {
    const [orders, commission] = await Promise.all([
      db.from("student_accounts").select("total_orders").eq("id", studentId).single(),
      loadCommissionConfig(db),
    ]);
    return resolveTier(Number(asRecord(orders.data).total_orders ?? 0) || 0, commission);
  } catch {
    return resolveTier(0);
  }
}
