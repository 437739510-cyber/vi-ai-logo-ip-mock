import type { Project } from "@/types";
import {
  deriveOperationalStatus,
  getWorkbenchClientInfo,
  hasFailureMarker,
  type OperationalStatus,
} from "./project-workbench";
import { businessDaysAgo, formatWaitDuration, isTerminalProject } from "./dashboard-tasks";

// ============================================================
// 项目交付队列（TICKET-132-R36）：视图 / 搜索 / 软删除 / 逾期 纯推导
// 只读复用 project-workbench.ts 运营状态推导；生产状态机由 R34 负责，本模块不改。
// R35 下钻 ?view= 兼容：awaiting_payment / review / overdue / failed。
// ============================================================

export type QueueViewKey =
  | "my_todos"
  | "all"
  | "awaiting_payment"
  | "review"
  | "overdue"
  | "awaiting_customer"
  | "ready_deliver"
  | "anomaly"
  | "failed"
  | "archived";

export interface QueueViewMeta {
  key: QueueViewKey;
  label: string;
  description: string;
  /** my_todos / overdue 按等待时长（最久在前），其余按更新时间倒序 */
  sort: "wait_desc" | "updated_desc";
}

export const QUEUE_VIEWS: QueueViewMeta[] = [
  { key: "my_todos", label: "我的待办", description: "需要人工处理的项目，按等待时长降序", sort: "wait_desc" },
  { key: "all", label: "全部订单", description: "所有未归档项目", sort: "updated_desc" },
  { key: "awaiting_payment", label: "待付款", description: "客户已提交 / 上传付款凭证，等待运营确认", sort: "updated_desc" },
  { key: "review", label: "待人工审核", description: "等待人工审核 / 校准", sort: "updated_desc" },
  { key: "overdue", label: "已逾期", description: "超过 SLA 未更新（兜底 3 个工作日），按等待时长降序", sort: "wait_desc" },
  { key: "awaiting_customer", label: "待客户确认", description: "等待客户确认 Logo / 反馈", sort: "updated_desc" },
  { key: "ready_deliver", label: "待交付", description: "手册已生成，可交付", sort: "updated_desc" },
  { key: "anomaly", label: "异常项目", description: "生成失败或异常标记", sort: "updated_desc" },
  { key: "archived", label: "已归档", description: "软删除项目（deleted_at 已标记）", sort: "updated_desc" },
];

/** R35 下钻 key 中 failed 与异常视图同源；其余非法值回退到 all */
export function normalizeQueueView(raw: string | null | undefined): QueueViewKey {
  if (raw === "failed") return "failed";
  const matched = QUEUE_VIEWS.find((v) => v.key === raw);
  return matched ? matched.key : "all";
}

/** 列表端筛选 / 搜索参数（getProjects 新增参数） */
export interface ProjectQueueFilters {
  view?: QueueViewKey;
  /** 客户名 / 手机号后四位 / 行业 / 套餐 / 负责人 / 学生 / 项目编号 关键字 */
  search?: string;
  /** YYYY-MM-DD，按 createdAt 过滤（含当天） */
  dateFrom?: string;
  dateTo?: string;
  /** 兼容旧 status 过滤（保留参数，视图优先） */
  status?: string;
}

export interface QueueContext {
  /** 测试注入当前时间 */
  now?: Date | string;
  /** SLA（工作日）；未配置时兜底 3 个工作日，与 R35 同口径 */
  overdueBusinessDays?: number;
  /** 当前管理员 / 学生身份（/api/admin/me），用于「我的待办」归属过滤 */
  currentUser?: { name?: string; role?: string; userId?: string } | null;
}

// ---------- 软删除 ----------

export interface ProjectDeletedFields {
  deletedAt?: string | null;
  deleted_at?: string | null;
}

export function getDeletedAt(project: Project): string | null {
  const row = project as Project & ProjectDeletedFields;
  const raw = row.deleted_at ?? row.deletedAt ?? null;
  return raw ? String(raw) : null;
}

export function isSoftDeleted(project: Project): boolean {
  return getDeletedAt(project) != null;
}

// ---------- 展示/搜索字段（兼容 Project 类型外的真实行字段） ----------

interface ProjectQueueRow {
  name?: string;
  companyName?: string;
  clientName?: string;
  industry?: string;
  studentName?: string;
  studentId?: string;
  assignedTo?: { name?: string } | null;
}

export function getQueueClientName(project: Project): string {
  const row = project as Project & ProjectQueueRow;
  return row.clientName || row.name || row.companyName || "";
}

export function getQueueIndustry(project: Project): string {
  return (project as Project & ProjectQueueRow).industry || "";
}

export function getQueueOwner(project: Project): string {
  const ci = getWorkbenchClientInfo(project);
  const row = project as Project & ProjectQueueRow;
  return ci.assignedTo?.name || row.assignedTo?.name || row.studentName || "";
}

export function getQueueStudent(project: Project): string {
  const row = project as Project & ProjectQueueRow;
  return row.studentName || row.studentId || "";
}

export function getQueuePlan(project: Project): string {
  return getWorkbenchClientInfo(project).paidPlan || "";
}

export function getQueuePhone(project: Project, phoneByProject?: Map<string, string>): string {
  const ci = getWorkbenchClientInfo(project) as Record<string, unknown>;
  if (typeof ci.phone === "string" && ci.phone) return ci.phone;
  return phoneByProject?.get(project.id) || "";
}

// ---------- 等待时长 / 逾期（SLA 兜底 3 工作日，与 R35 同口径） ----------

/** 各视图的等待起点：待付款用 paymentUploadedAt||createdAt，其余用 updatedAt||createdAt（R35 同口径） */
export function queueWaitReference(view: QueueViewKey, project: Project): string {
  const ci = getWorkbenchClientInfo(project);
  if (view === "awaiting_payment") {
    return ci.paymentUploadedAt || project.createdAt || project.updatedAt;
  }
  return project.updatedAt || project.createdAt;
}

export function isProjectOverdue(project: Project, ctx: QueueContext = {}): boolean {
  if (isTerminalProject(project)) return false;
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const slaDays = ctx.overdueBusinessDays ?? 3;
  const ts = new Date(queueWaitReference("overdue", project)).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts < businessDaysAgo(now, slaDays).getTime();
}

/** 人可读等待时长（「刚来」「3 小时」「2 天」） */
export function queueWaitLabel(view: QueueViewKey, project: Project, now?: Date): string {
  return formatWaitDuration(queueWaitReference(view, project), now ?? new Date());
}

// ---------- 搜索 / 日期范围 ----------

/** 手机号后四位 LIKE（或端上过滤）：关键词为纯数字时按手机号后缀匹配 */
export function matchesQueueSearch(
  project: Project,
  keyword: string,
  phoneByProject?: Map<string, string>,
): boolean {
  const kw = (keyword || "").toLowerCase().trim();
  if (!kw) return true;
  const haystack = [
    project.id,
    project.name,
    getQueueClientName(project),
    getQueueIndustry(project),
    getQueuePlan(project),
    getQueueOwner(project),
    getQueueStudent(project),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes(kw)) return true;

  const phoneDigits = getQueuePhone(project, phoneByProject).replace(/\D/g, "");
  if (!phoneDigits) return false;
  if (/^\d+$/.test(kw) && phoneDigits.endsWith(kw)) return true;
  const kwDigits = kw.replace(/\D/g, "");
  return kwDigits.length >= 4 && phoneDigits.includes(kwDigits);
}

export function inDateRange(project: Project, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const ts = new Date(project.createdAt || project.updatedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return ts >= start && ts <= end;
}

// ---------- 视图过滤 + 排序 ----------

const ACTIONABLE_OPERATIONAL: OperationalStatus[] = [
  "pending",
  "awaiting_payment",
  "review",
  "awaiting_customer",
  "ready_deliver",
  "anomaly",
];
const ACTIONABLE = new Set<OperationalStatus>(ACTIONABLE_OPERATIONAL);

/** 视图级过滤（只读推导），默认排除软删除；archived 只含软删除 */
export function applyQueueView(
  projects: Project[],
  view: QueueViewKey,
  ctx: QueueContext = {},
): Project[] {
  let list: Project[];
  if (view === "archived") {
    list = projects.filter(isSoftDeleted);
  } else {
    list = projects.filter((p) => !isSoftDeleted(p));
    switch (view) {
      case "all":
        break;
      case "my_todos": {
        const me = (ctx.currentUser?.name || "").trim();
        const restrictToMe = ctx.currentUser?.role === "student" && !!me;
        list = list.filter((p) => {
          if (!ACTIONABLE.has(deriveOperationalStatus(p))) return false;
          if (!restrictToMe) return true;
          const owner = getQueueOwner(p);
          return !!owner && owner === me;
        });
        break;
      }
      case "awaiting_payment":
        list = list.filter((p) => deriveOperationalStatus(p) === "awaiting_payment");
        break;
      case "review":
        list = list.filter((p) => deriveOperationalStatus(p) === "review");
        break;
      case "awaiting_customer":
        list = list.filter((p) => deriveOperationalStatus(p) === "awaiting_customer");
        break;
      case "ready_deliver":
        list = list.filter((p) => deriveOperationalStatus(p) === "ready_deliver");
        break;
      case "anomaly":
      case "failed":
        // R35 failed 与异常视图同源：内部状态或项目状态命中失败集合
        list = list.filter((p) => hasFailureMarker(p) || deriveOperationalStatus(p) === "anomaly");
        break;
      case "overdue":
        // 视图级推导：无单一 status 兜底
        list = list.filter((p) => isProjectOverdue(p, ctx));
        break;
    }
  }
  return sortQueueView(list, view, ctx);
}

function viewMeta(view: QueueViewKey): QueueViewMeta {
  return QUEUE_VIEWS.find((v) => v.key === view) ?? QUEUE_VIEWS.find((v) => v.key === "all")!;
}

function referenceTime(view: QueueViewKey, project: Project): number {
  const ts = new Date(queueWaitReference(view, project)).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function sortQueueView(list: Project[], view: QueueViewKey, ctx: QueueContext = {}): Project[] {
  const meta = viewMeta(view);
  if (meta.sort === "wait_desc") {
    return [...list].sort((a, b) => referenceTime(view, a) - referenceTime(view, b));
  }
  return [...list].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
  );
}
