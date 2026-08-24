import type { Project } from "@/types";
import {
  deriveOperationalStatus,
  getWorkbenchClientInfo,
  hasFailureMarker,
} from "./project-workbench";

// ============================================================
// 工作台今日待办（TICKET-131-R35）：四类任务卡聚合，只读推导
// - 待付款确认 = 运营状态 awaiting_payment（复用 project-workbench）
// - 待人工审核 = 运营状态 review（复用 project-workbench）
// - 已逾期     = 最后更新距今超过 SLA（无 SLA 配置时兜底 3 个工作日）
// - 生成失败   = 内部技术状态含失败标记（复用 project-workbench 失败集合）
// 纯函数、零写入，便于 mock 冒烟测试；列表端 view 筛选由 R36 落地。
// ============================================================

export type DashboardTaskKey = "awaiting_payment" | "review" | "overdue" | "failed";

export interface DashboardTaskCard {
  key: DashboardTaskKey;
  label: string;
  description: string;
  count: number;
  /** 最早一条等待时长（人类可读），无成员时为 null */
  earliestWaitLabel: string | null;
  /** 最早一条等待起点的参考时间（ISO），无成员时为 null */
  earliestReferenceAt: string | null;
  /** 主操作：进入对应筛选列表 */
  href: string;
  /** 列表端兜底 status 筛选（R36 视图切换落地前可用） */
  fallbackStatus?: string;
}

export interface DashboardTasksOptions {
  /** 已逾期 SLA（工作日）；未配置 SLA 时兜底 3 个工作日 */
  overdueBusinessDays?: number;
  /** 测试注入当前时间 */
  now?: Date | string;
}

const TERMINAL_STATUSES = new Set(["completed", "delivered"]);

const CARD_META: Record<DashboardTaskKey, { label: string; description: string; fallbackStatus?: string }> = {
  awaiting_payment: {
    label: "待付款确认",
    description: "客户已提交 / 上传付款凭证，等待运营确认",
    fallbackStatus: "payment_uploaded",
  },
  review: {
    label: "待人工审核",
    description: "等待人工审核 / 校准",
    fallbackStatus: "waiting_manual_review",
  },
  overdue: {
    label: "已逾期",
    description: "超过 SLA 未更新",
  },
  failed: {
    label: "生成失败",
    description: "内部生成状态含失败标记",
    fallbackStatus: "failed",
  },
};

/** 当前时间点往前数 N 个工作日（跳过周六周日）的截止时间 */
export function businessDaysAgo(now: Date, days: number): Date {
  const cutoff = new Date(now);
  let remaining = Math.max(0, days);
  while (remaining > 0) {
    cutoff.setDate(cutoff.getDate() - 1);
    const dow = cutoff.getDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return cutoff;
}

/** 各类任务的等待起点（参考时间） */
export function waitReferenceFor(key: DashboardTaskKey, project: Project): string {
  const ci = getWorkbenchClientInfo(project);
  switch (key) {
    case "awaiting_payment":
      return ci.paymentUploadedAt || project.createdAt || project.updatedAt;
    case "review":
    case "failed":
    case "overdue":
      return project.updatedAt || project.createdAt;
  }
}

/** 等待时长格式化（与 project-workbench.waitingDuration 同风格，支持注入 now） */
export function formatWaitDuration(referenceAt: string, now: Date): string {
  const ts = new Date(referenceAt).getTime();
  if (!Number.isFinite(ts)) return "刚刚";
  const diffMs = now.getTime() - ts;
  if (diffMs < 0) return "刚刚";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 0 ? "刚刚" : `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

/** 是否已完结（已完成/已交付不再计入逾期任务） */
export function isTerminalProject(project: Project): boolean {
  return TERMINAL_STATUSES.has(project.status);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function isValidReference(value: string | undefined | null): boolean {
  return !!value && Number.isFinite(new Date(value).getTime());
}

/** 四类任务卡聚合：数量 + 最早等待时长 + 下钻地址（只读） */
export function deriveDashboardTaskCards(
  projects: Project[],
  options: DashboardTasksOptions = {},
): DashboardTaskCard[] {
  const now = options.now ? toDate(options.now) : new Date();
  const slaDays = options.overdueBusinessDays ?? 3;
  const overdueCutoff = businessDaysAgo(now, slaDays);

  const members: Record<DashboardTaskKey, string[]> = {
    awaiting_payment: [],
    review: [],
    overdue: [],
    failed: [],
  };

  for (const project of projects) {
    const ops = deriveOperationalStatus(project);
    if (ops === "awaiting_payment") members.awaiting_payment.push(waitReferenceFor("awaiting_payment", project));
    if (ops === "review") members.review.push(waitReferenceFor("review", project));
    if (hasFailureMarker(project)) members.failed.push(waitReferenceFor("failed", project));
    if (!isTerminalProject(project) && new Date(project.updatedAt).getTime() < overdueCutoff.getTime()) {
      members.overdue.push(waitReferenceFor("overdue", project));
    }
  }

  return (Object.keys(CARD_META) as DashboardTaskKey[]).map((key) => {
    const refs = members[key].filter(isValidReference);
    const earliestReferenceAt =
      refs.length > 0
        ? refs.reduce((a, b) => (new Date(a).getTime() <= new Date(b).getTime() ? a : b))
        : null;
    const meta = CARD_META[key];
    return {
      key,
      label: meta.label,
      description: meta.description,
      count: refs.length,
      earliestWaitLabel: earliestReferenceAt ? formatWaitDuration(earliestReferenceAt, now) : null,
      earliestReferenceAt,
      href: `/admin/projects?view=${key}`,
      ...(meta.fallbackStatus ? { fallbackStatus: meta.fallbackStatus } : {}),
    };
  });
}
