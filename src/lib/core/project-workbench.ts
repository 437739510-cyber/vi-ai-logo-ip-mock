import type { Project } from "@/types";

// ============================================================
// 项目作业台（TICKET-130-R33）：运营状态 / 内部技术状态 / 主操作 / 展示工具
// 只做只读推导与展示组装；生产状态机本身由 R34 负责。
// ============================================================

export type OperationalStatus =
  | "pending"
  | "awaiting_payment"
  | "generating"
  | "review"
  | "awaiting_customer"
  | "ready_deliver"
  | "completed"
  | "delivered"
  | "anomaly";

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  pending: "待处理",
  awaiting_payment: "待付款",
  generating: "生成中",
  review: "待审核",
  awaiting_customer: "待客户确认",
  ready_deliver: "待交付",
  completed: "已完成",
  delivered: "已交付",
  anomaly: "异常",
};

export const OPERATIONAL_STATUS_COLORS: Record<OperationalStatus, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  awaiting_payment: "bg-amber-100 text-amber-700",
  generating: "bg-blue-100 text-blue-700",
  review: "bg-orange-100 text-orange-700",
  awaiting_customer: "bg-purple-100 text-purple-700",
  ready_deliver: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  anomaly: "bg-red-100 text-red-700",
};

export interface InternalNote {
  id: string;
  note: string;
  author: string;
  at: string;
}

export interface ClientInfoLike {
  generationStatus?: string;
  generationMessage?: string;
  paymentConfirmed?: boolean;
  paidPlan?: string;
  paidAt?: string;
  paymentScreenshot?: string;
  paymentUploadedAt?: string;
  viewPassword?: string;
  pptxResult?: {
    url?: string;
    downloadUrl?: string;
    storageUrl?: string;
    pageCount?: number;
    fileName?: string;
  } | null;
  pdfUrl?: string;
  brandProfile?: Record<string, any> | null;
  logoGenerationStatus?: Record<string, any> | null;
  selectedLogo?: unknown;
  mascotAssets?: Record<string, any> | null;
  manualReviewStatus?: string;
  internalNotes?: InternalNote[];
  assignedTo?: { name: string; assignedBy?: string; at?: string } | null;
  regenerationFeedback?: { feedback: string; at?: string }[];
  [key: string]: unknown;
}

const GENERATING_STATUSES = new Set([
  "brand_analyzing",
  "logo_generating",
  "mascot_pending",
  "mascot_generating",
  "mascot_full_generating",
  "scene_rendering",
  "pptx_assembling",
  "manual_generating",
  "designing",
  "ai_analysis",
]);

const ANOMALY_STATUSES = new Set([
  "failed",
  "mascot_failed",
  "mascot_sample_fail",
  "mascot_full_fail",
  "manual_render_fail",
]);

const REVIEW_STATUSES = new Set([
  "waiting_manual_review",
  "pending_manual",
  "manual_pending",
]);

export function getWorkbenchClientInfo(project: Project): ClientInfoLike {
  return ((project as any).client_info || {}) as ClientInfoLike;
}

/** 内部技术状态：client_info.generationStatus（completed 兜底） */
export function getGenerationStatus(project: Project): string {
  const ci = getWorkbenchClientInfo(project);
  if (ci.generationStatus === "completed" || project.status === "completed") return "completed";
  return ci.generationStatus || "pending";
}

/** 运营状态：由项目状态 + client_info 只读推导 */
export function deriveOperationalStatus(project: Project): OperationalStatus {
  const ci = getWorkbenchClientInfo(project);
  const genStatus = getGenerationStatus(project);
  const status = project.status;

  if (ANOMALY_STATUSES.has(genStatus)) return "anomaly";
  if (status === "delivered") return "delivered";
  if (status === "completed" || genStatus === "completed") return "completed";
  if (status === "payment_uploaded") return "awaiting_payment";
  if (status === "submitted" && !ci.paymentConfirmed) return "awaiting_payment";
  if (REVIEW_STATUSES.has(genStatus) || status === "manual_pending" || status === "waiting_manual_review") return "review";
  if ((genStatus === "logo_generated" || genStatus === "logo_selecting") && !ci.brandProfile?.selectedLogo) return "awaiting_customer";
  if (genStatus === "manual_review_complete") return ci.pptxResult ? "ready_deliver" : "generating";
  if (GENERATING_STATUSES.has(genStatus)) return "generating";
  return "pending";
}

export type PrimaryActionKey =
  | "assign_owner"
  | "mark_paid"
  | "approve_review"
  | "enter_anomaly"
  | "refresh"
  | "view_feedback"
  | "download";

export interface PrimaryAction {
  key: PrimaryActionKey;
  label: string;
  description: string;
}

/** 下一步主操作：按当前阶段推导（未分配负责人优先） */
export function nextPrimaryAction(project: Project): PrimaryAction {
  const ci = getWorkbenchClientInfo(project);
  const ops = deriveOperationalStatus(project);
  const owner = ci.assignedTo?.name || project.assignedTo?.name || project.studentName || "";

  if (!owner && (ops === "pending" || ops === "awaiting_payment" || ops === "generating")) {
    return { key: "assign_owner", label: "分配负责人", description: "当前项目未分配负责人" };
  }
  switch (ops) {
    case "awaiting_payment":
      return {
        key: "mark_paid",
        label: project.status === "payment_uploaded" ? "确认付款" : "标记已付款",
        description: "确认客户付款后进入生产队列",
      };
    case "review":
      return { key: "approve_review", label: "人工审核通过", description: "推进到下一生产阶段" };
    case "anomaly":
      return { key: "enter_anomaly", label: "进入异常处理", description: "查看异常详情与技术状态" };
    case "awaiting_customer":
      return { key: "view_feedback", label: "查看客户反馈", description: "查看客户 Logo 意见与沟通记录" };
    case "ready_deliver":
    case "completed":
    case "delivered":
      return { key: "download", label: "下载交付文件", description: "预览并下载 VI 手册" };
    default:
      return { key: "refresh", label: "刷新状态", description: "刷新项目生产状态" };
  }
}

/** 脱敏手机号：138****1234 */
export function maskPhone(phone: string): string {
  if (!phone) return "-";
  const digits = phone.replace(/\s/g, "");
  if (digits.length < 7) return digits;
  return digits.slice(0, 3) + "****" + digits.slice(-4);
}

export function formatDateTime(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN");
}

/** 等待时长：距给定时间点已过去多久 */
export function waitingDuration(value?: string): string {
  if (!value) return "-";
  const ts = new Date(value).getTime();
  if (isNaN(ts)) return "-";
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "刚刚";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 0 ? "刚刚" : `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

/** 内部技术状态明细（收进“异常/详情”展开区） */
export function technicalStatusItems(project: Project): { label: string; value: string }[] {
  const ci = getWorkbenchClientInfo(project);
  const bp = ci.brandProfile || {};
  const logoGen = ci.logoGenerationStatus || {};
  return [
    { label: "项目状态", value: project.status || "-" },
    { label: "生成状态", value: ci.generationStatus || "pending" },
    { label: "生成消息", value: ci.generationMessage || "-" },
    { label: "品牌分析", value: bp.analysisStatus || "-" },
    {
      label: "Logo 进度",
      value: logoGen.total ? `${logoGen.completed || 0} / ${logoGen.total}` : "-",
    },
    {
      label: "人工审核",
      value: ci.manualReviewStatus || (ci.generationStatus === "manual_review_complete" ? "manual_review_complete" : "-"),
    },
    { label: "套餐", value: ci.paidPlan || "-" },
  ];
}
