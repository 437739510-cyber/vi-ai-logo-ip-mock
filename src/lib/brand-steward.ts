// TICKET-122-R23：品牌管家配额与订阅闭环（GAP-F）。
// 与 HTTP 路由分离，业务逻辑可注入 Supabase 客户端，便于离线 mock 回归验证。
//
// 方案定案（执行手调查后说明）：
//   - 品牌管家 = members.plan === "manager"，每月 12 条（quota_total=12）；
//   - 订阅记录表 brand_steward_subscriptions 保存生效期（起止时间）；
//   - 周期采用「按生效期核算」：以激活/续费时刻起算 30 天为一个计费周期，
//     不依赖 cron；任何配额检查/扣减入口先调用 syncSubscriptionPeriod 做惰性
//     同步，当前时间越过周期结束点即置 expired（到期停发即停费）；
//   - 续费（管理员确认新一期付款）重置 quota_used=0，周期顺延/重开；
//   - 暂停/恢复由管理员操作；暂停期间配额检查直接拒绝。
//
// 配额口径：members.quota_used / quota_total 仍是扣减的落库真源（既有路由沿用），
// 订阅表负责状态机与周期；激活/续费时同步写 members.plan/quota_total/quota_used。

import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export type SubscriptionStatus = "active" | "expired" | "paused";
export type QuotaReason = "ok" | "exhausted" | "expired" | "paused" | "no_member";

export const SUBSCRIPTION_RULES = {
  plan: "manager",
  monthlyQuota: 12,
  periodDays: 30,
} as const;

export class SubscriptionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SubscriptionError";
    this.status = status;
  }
}

export interface SubscriptionRecord {
  id: string;
  memberId: string;
  plan: string;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  quotaTotal: number;
  sourceProjectId: string | null;
  startedAt: string;
  renewedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberQuota {
  id: string;
  phone: string | null;
  name: string | null;
  plan: string | null;
  quota_used: number;
  quota_total: number;
}

export interface QuotaDecision {
  allowed: boolean;
  reason: QuotaReason;
  message: string;
  needUpgrade: boolean;
  member: MemberQuota | null;
  subscription: SubscriptionRecord | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function addDaysIso(base: Date | string, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function normalizeSubscription(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: String(row.id ?? ""),
    memberId: String(row.member_id ?? ""),
    plan: String(row.plan ?? SUBSCRIPTION_RULES.plan),
    status: (row.status as SubscriptionStatus) || "active",
    periodStart: String(row.period_start ?? ""),
    periodEnd: String(row.period_end ?? ""),
    quotaTotal: Number(row.quota_total ?? SUBSCRIPTION_RULES.monthlyQuota),
    sourceProjectId: row.source_project_id == null ? null : String(row.source_project_id),
    startedAt: String(row.started_at ?? ""),
    renewedAt: row.renewed_at == null ? null : String(row.renewed_at),
    pausedAt: row.paused_at == null ? null : String(row.paused_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeMember(row: Record<string, unknown>): MemberQuota {
  return {
    id: String(row.id ?? ""),
    phone: row.phone == null ? null : String(row.phone),
    name: row.name == null ? null : String(row.name),
    plan: row.plan == null ? null : String(row.plan),
    quota_used: Number(row.quota_used ?? 0) || 0,
    quota_total: Number(row.quota_total ?? 0) || 0,
  };
}

/** 订阅表尚未部署时降级为「无订阅记录」，配额仍由 members 字段强制（安全默认）。 */
function isMissingTableError(error: unknown): boolean {
  const code = String((error as Record<string, unknown>)?.code ?? "");
  const message = String((error as Error)?.message ?? "");
  return code === "PGRST301" || /does not exist/i.test(message);
}

// ---------------------------------------------------------------------------
// 订阅周期：惰性同步（到期置 expired）与读取
// ---------------------------------------------------------------------------

/** 当前时间越过周期结束点 → active 置 expired（到期停发即停费）。 */
export async function syncSubscriptionPeriod(db: Db, memberId: string, now?: Date): Promise<SubscriptionRecord | null> {
  const { data, error } = await db
    .from("brand_steward_subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw new SubscriptionError(error.message, 500);
  }
  if (!data) return null;

  const row = asRecord(data);
  const current = now ?? new Date();
  if (row.status === "active" && current >= new Date(String(row.period_end ?? ""))) {
    const iso = current.toISOString();
    const { error: updateErr } = await db
      .from("brand_steward_subscriptions")
      .update({ status: "expired", updated_at: iso })
      .eq("member_id", memberId);
    if (updateErr) throw new SubscriptionError(updateErr.message, 500);
    return normalizeSubscription({ ...row, status: "expired", updated_at: iso });
  }
  return normalizeSubscription(row);
}

export async function getSubscription(db: Db, memberId: string, now?: Date): Promise<SubscriptionRecord | null> {
  return syncSubscriptionPeriod(db, memberId, now);
}

// ---------------------------------------------------------------------------
// 订阅激活 / 续费 / 暂停 / 恢复
// ---------------------------------------------------------------------------

/**
 * 管理员确认付款后调用：通过项目反查客户（projects → submissions → members），
 * 激活或续费品牌管家订阅并重置配额（不再靠人工改 plan/quota_total）。
 */
export async function activateSubscriptionForProject(
  db: Db,
  projectId: string,
  operatorId?: string,
  now?: Date,
): Promise<{ subscription: SubscriptionRecord; memberId: string }> {
  if (!projectId) throw new SubscriptionError("缺少项目 ID", 400);

  const { data: project, error: projErr } = await db
    .from("projects")
    .select("submission_id")
    .eq("id", projectId)
    .single();
  if (projErr || !project) throw new SubscriptionError("项目不存在", 404);
  const submissionId = String(asRecord(project).submission_id ?? "");
  if (!submissionId) throw new SubscriptionError("项目缺少 submission_id", 400);

  const { data: submission, error: subErr } = await db
    .from("submissions")
    .select("phone")
    .eq("id", submissionId)
    .single();
  if (subErr || !submission) throw new SubscriptionError("提交记录不存在", 404);
  const phone = String(asRecord(submission).phone ?? "");
  if (!phone) throw new SubscriptionError("提交记录缺少手机号", 400);

  const { data: member, error: memErr } = await db
    .from("members")
    .select("id, phone, name, plan, quota_used, quota_total")
    .eq("phone", phone)
    .single();
  if (memErr || !member) throw new SubscriptionError("客户账号不存在", 404);

  return activateSubscriptionForMember(db, String(asRecord(member).id), projectId, operatorId, now);
}

/**
 * 激活/续费：
 *   - 无订阅或已过期/暂停 → 新周期从当前时刻起 30 天；
 *   - 仍在生效期内续费 → 周期从原结束点顺延 30 天；
 *   - 一律重置 quota_used=0 并把 quota_total=12、plan=manager 写回 members。
 */
export async function activateSubscriptionForMember(
  db: Db,
  memberId: string,
  sourceProjectId?: string,
  operatorId?: string,
  now?: Date,
): Promise<{ subscription: SubscriptionRecord; memberId: string }> {
  if (!memberId) throw new SubscriptionError("缺少客户 ID", 400);
  const current = now ?? new Date();
  const iso = current.toISOString();

  const { data: existing, error: readErr } = await db
    .from("brand_steward_subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (readErr) {
    if (isMissingTableError(readErr)) {
      throw new SubscriptionError("订阅表尚未部署，请先应用迁移", 500);
    }
    throw new SubscriptionError(readErr.message, 500);
  }

  let subscription: SubscriptionRecord;
  if (existing) {
    const row = asRecord(existing);
    const stillInPeriod = row.status === "active" && current < new Date(String(row.period_end ?? ""));
    const nextPeriodStart = stillInPeriod ? String(row.period_start ?? iso) : iso;
    const nextPeriodEnd = stillInPeriod
      ? addDaysIso(new Date(String(row.period_end ?? "")), SUBSCRIPTION_RULES.periodDays)
      : addDaysIso(current, SUBSCRIPTION_RULES.periodDays);
    const updates: Record<string, unknown> = {
      plan: SUBSCRIPTION_RULES.plan,
      status: "active",
      period_start: nextPeriodStart,
      period_end: nextPeriodEnd,
      quota_total: SUBSCRIPTION_RULES.monthlyQuota,
      source_project_id: sourceProjectId ?? row.source_project_id ?? null,
      renewed_at: iso,
      paused_at: null,
      updated_at: iso,
    };
    const { error: updateErr } = await db
      .from("brand_steward_subscriptions")
      .update(updates)
      .eq("member_id", memberId);
    if (updateErr) throw new SubscriptionError(updateErr.message, 500);
    subscription = normalizeSubscription({ ...row, ...updates, started_at: row.started_at });
  } else {
    const row: Record<string, unknown> = {
      id: `BS-${memberId}`,
      member_id: memberId,
      plan: SUBSCRIPTION_RULES.plan,
      status: "active",
      period_start: iso,
      period_end: addDaysIso(current, SUBSCRIPTION_RULES.periodDays),
      quota_total: SUBSCRIPTION_RULES.monthlyQuota,
      source_project_id: sourceProjectId ?? null,
      started_at: iso,
      renewed_at: iso,
      paused_at: null,
      created_at: iso,
      updated_at: iso,
    };
    const { error: insertErr } = await db.from("brand_steward_subscriptions").insert(row);
    if (insertErr) throw new SubscriptionError(insertErr.message, 500);
    subscription = normalizeSubscription(row);
  }

  const { error: memUpdateErr } = await db
    .from("members")
    .update({
      plan: SUBSCRIPTION_RULES.plan,
      quota_total: SUBSCRIPTION_RULES.monthlyQuota,
      quota_used: 0,
    })
    .eq("id", memberId);
  if (memUpdateErr) throw new SubscriptionError(memUpdateErr.message, 500);

  return { subscription, memberId };
}

/** 暂停（停发即停费）：active → paused；已暂停幂等返回。 */
export async function pauseSubscription(db: Db, memberId: string, operatorId?: string, now?: Date): Promise<SubscriptionRecord> {
  const sub = await syncSubscriptionPeriod(db, memberId, now);
  if (!sub) throw new SubscriptionError("该客户没有品牌管家订阅", 404);
  if (sub.status === "paused") return sub;
  if (sub.status === "expired") throw new SubscriptionError("订阅已到期，无法暂停；请先续费", 409);

  const iso = nowIso(now);
  const { data, error } = await db
    .from("brand_steward_subscriptions")
    .update({ status: "paused", paused_at: iso, updated_at: iso })
    .eq("member_id", memberId)
    .select()
    .single();
  if (error) throw new SubscriptionError(error.message, 500);
  return normalizeSubscription((data as Record<string, unknown>) ?? { ...sub, status: "paused", paused_at: iso, updated_at: iso });
}

/** 恢复：paused → active；暂停期间周期已过则重开周期并重置配额。 */
export async function resumeSubscription(db: Db, memberId: string, operatorId?: string, now?: Date): Promise<SubscriptionRecord> {
  const sub = await syncSubscriptionPeriod(db, memberId, now);
  if (!sub) throw new SubscriptionError("该客户没有品牌管家订阅", 404);
  if (sub.status === "active") return sub;
  if (sub.status === "expired") throw new SubscriptionError("订阅已到期，请续费后恢复", 409);

  const current = now ?? new Date();
  const iso = current.toISOString();
  const periodExpired = current >= new Date(sub.periodEnd);
  const updates: Record<string, unknown> = {
    status: "active",
    paused_at: null,
    updated_at: iso,
  };
  if (periodExpired) {
    updates.period_start = iso;
    updates.period_end = addDaysIso(current, SUBSCRIPTION_RULES.periodDays);
    updates.quota_total = SUBSCRIPTION_RULES.monthlyQuota;
    updates.renewed_at = iso;
  }
  const { data, error } = await db
    .from("brand_steward_subscriptions")
    .update(updates)
    .eq("member_id", memberId)
    .select()
    .single();
  if (error) throw new SubscriptionError(error.message, 500);

  if (periodExpired) {
    const { error: memErr } = await db
      .from("members")
      .update({ plan: SUBSCRIPTION_RULES.plan, quota_total: SUBSCRIPTION_RULES.monthlyQuota, quota_used: 0 })
      .eq("id", memberId);
    if (memErr) throw new SubscriptionError(memErr.message, 500);
  }
  return normalizeSubscription((data as Record<string, unknown>) ?? { ...sub, ...updates });
}

// ---------------------------------------------------------------------------
// 配额检查 / 扣减（所有生成路径共用；到期/暂停直接拒绝）
// ---------------------------------------------------------------------------

export async function checkMemberQuota(db: Db, memberId: string, now?: Date): Promise<QuotaDecision> {
  const { data: member, error } = await db
    .from("members")
    .select("id, phone, name, plan, quota_used, quota_total")
    .eq("id", memberId)
    .single();
  if (error || !member) {
    return { allowed: false, reason: "no_member", message: "用户不存在", needUpgrade: false, member: null, subscription: null };
  }
  const memberRow = normalizeMember(asRecord(member));
  const subscription = await syncSubscriptionPeriod(db, memberId, now);

  if (subscription && subscription.status === "expired") {
    return {
      allowed: false,
      reason: "expired",
      message: "品牌管家已到期，请续费",
      needUpgrade: true,
      member: memberRow,
      subscription,
    };
  }
  if (subscription && subscription.status === "paused") {
    return {
      allowed: false,
      reason: "paused",
      message: "品牌管家服务已暂停，请联系客服",
      needUpgrade: false,
      member: memberRow,
      subscription,
    };
  }

  if (memberRow.quota_used >= memberRow.quota_total) {
    const isFree = memberRow.plan === "free" || !memberRow.plan;
    return {
      allowed: false,
      reason: "exhausted",
      message: isFree ? "免费体验已用完，开通会员¥199/月" : "本月配额已用完，请联系升级品牌管家",
      needUpgrade: true,
      member: memberRow,
      subscription,
    };
  }
  return { allowed: true, reason: "ok", message: "", needUpgrade: false, member: memberRow, subscription };
}

/** 生成成功后扣减一条配额（调用方必须先过 checkMemberQuota）。 */
export async function consumeMemberQuota(
  db: Db,
  memberId: string,
  now?: Date,
): Promise<{ quotaUsed: number; quotaTotal: number }> {
  await syncSubscriptionPeriod(db, memberId, now);
  const { data: member, error } = await db
    .from("members")
    .select("quota_used, quota_total")
    .eq("id", memberId)
    .single();
  if (error || !member) throw new SubscriptionError("用户不存在", 404);
  const row = asRecord(member);
  const next = (Number(row.quota_used) || 0) + 1;
  const { error: updateErr } = await db
    .from("members")
    .update({ quota_used: next })
    .eq("id", memberId);
  if (updateErr) throw new SubscriptionError(updateErr.message, 500);
  return { quotaUsed: next, quotaTotal: Number(row.quota_total) || 0 };
}
