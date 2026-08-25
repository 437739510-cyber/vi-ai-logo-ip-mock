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

/** 兼容 API select 部分行 / 页面 Props 的结构化视图（R34 只读派生使用） */
export interface ProjectLike {
  id: string;
  status?: string | null;
  client_info?: Record<string, any> | null;
  deleted_at?: string | null;
  deletedAt?: string | null;
  assignedTo?: { name?: string; assignedBy?: string; at?: string } | null;
  studentName?: string;
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

export function getWorkbenchClientInfo(project: ProjectLike): ClientInfoLike {
  return (project.client_info || {}) as ClientInfoLike;
}

/** 内部技术状态：client_info.generationStatus（completed 兜底） */
export function getGenerationStatus(project: ProjectLike): string {
  const ci = getWorkbenchClientInfo(project);
  if (ci.generationStatus === "completed" || project.status === "completed") return "completed";
  return ci.generationStatus || "pending";
}

/** 运营状态：由项目状态 + client_info 只读推导 */
export function deriveOperationalStatus(project: ProjectLike): OperationalStatus {
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

// ============================================================
// R34 统一业务状态机：14 态中文展示 + 付款/生产/交付规则约束
// 只读推导；不改历史数据、不改结算/归属逻辑。
// ============================================================

export type BusinessStatus =
  | "awaiting_confirm"
  | "awaiting_payment"
  | "paid"
  | "analyzing"
  | "generating"
  | "review"
  | "awaiting_customer"
  | "delivering"
  | "delivered"
  | "archived"
  | "modifying"
  | "refunding"
  | "anomaly"
  | "cancelled";

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  awaiting_confirm: "待确认",
  awaiting_payment: "待付款",
  paid: "已付款",
  analyzing: "分析中",
  generating: "方案生成中",
  review: "待人工审核",
  awaiting_customer: "待客户确认",
  delivering: "交付中",
  delivered: "已交付",
  archived: "已归档",
  modifying: "修改中",
  refunding: "退款中",
  anomaly: "异常",
  cancelled: "已取消",
};

export const BUSINESS_STATUS_COLORS: Record<BusinessStatus, string> = {
  awaiting_confirm: "bg-neutral-100 text-neutral-700",
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  analyzing: "bg-sky-100 text-sky-700",
  generating: "bg-blue-100 text-blue-700",
  review: "bg-orange-100 text-orange-700",
  awaiting_customer: "bg-purple-100 text-purple-700",
  delivering: "bg-cyan-100 text-cyan-700",
  delivered: "bg-green-100 text-green-700",
  archived: "bg-neutral-200 text-neutral-600",
  modifying: "bg-yellow-100 text-yellow-700",
  refunding: "bg-rose-100 text-rose-700",
  anomaly: "bg-red-100 text-red-700",
  cancelled: "bg-gray-300 text-gray-600",
};

export const BUSINESS_STATUS_NEXT_ACTIONS: Record<BusinessStatus, string> = {
  awaiting_confirm: "确认需求并引导客户付款",
  awaiting_payment: "确认收款（标记已付款）",
  paid: "等待本地 Worker 领取生产",
  analyzing: "等待品牌分析完成",
  generating: "等待方案生成完成",
  review: "人工审核生产结果",
  awaiting_customer: "等待客户选择 LOGO / IP 公仔",
  delivering: "交付 VI 手册文件",
  delivered: "已交付（可发起修改/退款）",
  archived: "已归档，只读",
  modifying: "修改中，完成后回到待客户确认",
  refunding: "退款处理中，文件下载已锁定",
  anomaly: "异常处理（重试或人工接管）",
  cancelled: "已取消（终态）",
};

/** 已确认付款的项目状态集合（与详情页 PAID_AFTER 同源） */
export const PAID_PROJECT_STATUSES = new Set([
  "paid", "confirmed", "ai_analysis", "designing", "reviewing", "delivered",
  "brand_analyzed", "brand_analyzing", "logo_generated", "logo_generating",
  "mascot_generating", "mascot_generated", "mascot_failed", "mascot_sample_fail",
  "mascot_full_fail", "waiting_manual_review", "manual_review_complete",
  "manual_render_fail", "manual_pending", "manual_generating", "scene_rendering",
  "pptx_assembling", "completed", "failed",
]);

/** 测试工单：ID 以 TEST/ 前缀判定（Chris 2026-08-25 确认） */
export function isTestProjectId(projectId: string): boolean {
  return /^TEST\//.test((projectId || "").trim());
}

/** 项目是否已付款（持久标记优先，兼容旧 status=paid 项目） */
export function isProjectPaid(project: ProjectLike): boolean {
  const ci = getWorkbenchClientInfo(project);
  if (ci.paymentConfirmed === true) return true;
  return PAID_PROJECT_STATUSES.has((project.status || "").trim());
}

export const PRODUCTION_BLOCKED_MESSAGE = "未付款不能生产";
export const PRODUCTION_BLOCKED_CODE = "PAYMENT_REQUIRED";

/** 生产前置门禁：测试工单豁免；其余项目必须已付款 */
export function canStartProduction(project: ProjectLike): boolean {
  if (isTestProjectId(project.id)) return true;
  return isProjectPaid(project);
}

/** 仅含原始 project.status 的兜底映射（客户管理行无 client_info 时展示用） */
export function businessStatusFromProjectStatus(status?: string | null): BusinessStatus {
  const s = (status || "").trim();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "refunding") return "refunding";
  if (s === "modifying") return "modifying";
  if (s === "delivered" || s === "completed") return "delivered";
  if (s === "failed") return "anomaly";
  if (s === "payment_uploaded" || s === "submitted") return "awaiting_payment";
  if (s === "paid" || s === "confirmed") return "paid";
  if (s === "ai_analysis" || s === "brand_analyzing") return "analyzing";
  if (s === "reviewing" || s === "waiting_manual_review" || s === "manual_pending") return "review";
  if (s === "logo_generated" || s === "logo_selecting") return "awaiting_customer";
  if (PAID_PROJECT_STATUSES.has(s)) return "generating";
  return "awaiting_confirm";
}

/** 统一业务状态推导：14 态只读派生（R34） */
export function deriveBusinessStatus(project: ProjectLike): BusinessStatus {
  const ci = getWorkbenchClientInfo(project);
  const genStatus = getGenerationStatus(project);
  const status = (project.status || "").trim();

  // 归档（软删除）
  if (project.deleted_at || project.deletedAt) return "archived";
  // 已取消（终态）
  if (status === "cancelled" || status === "canceled") return "cancelled";
  // 退款中
  if (status === "refunding" || ci.refundStatus === "refunding") return "refunding";
  // 修改中
  if (status === "modifying" || ci.modificationStatus === "modifying") return "modifying";
  // 异常（失败标记）
  if (ANOMALY_STATUSES.has(genStatus) || ANOMALY_STATUSES.has(status)) return "anomaly";
  // 已交付 / 已完成 → 已交付
  if (status === "delivered") return "delivered";
  if (status === "completed" || genStatus === "completed") return "delivered";
  // 交付中：人工审核通过且已产出 PPTX
  if (genStatus === "manual_review_complete") return ci.pptxResult ? "delivering" : "awaiting_customer";
  // 待人工审核
  if (REVIEW_STATUSES.has(genStatus) || status === "manual_pending" || status === "waiting_manual_review" || status === "reviewing") return "review";
  // 待客户确认：客户确认 = 选择 LOGO / IP 公仔（现有流程）
  const needsLogoSelection = (genStatus === "logo_generated" || genStatus === "logo_selecting") && !ci.brandProfile?.selectedLogo;
  const needsMascotSelection = ci.wantMascot === "yes" && !ci.mascotSelectedId &&
    (genStatus === "mascot_generated" || genStatus === "mascot_samples_ready");
  if (needsLogoSelection || needsMascotSelection) return "awaiting_customer";
  // 分析中
  if (genStatus === "brand_analyzing" || genStatus === "ai_analysis") return "analyzing";
  // 方案生成中
  if (GENERATING_STATUSES.has(genStatus)) return "generating";
  if (genStatus === "logo_generated" || genStatus === "logo_selecting" || genStatus === "mascot_generated" || genStatus === "mascot_samples_ready") return "generating";
  // 已付款（尚未进入生产）
  if (status === "paid" || ci.paymentConfirmed === true || PAID_PROJECT_STATUSES.has(status)) return "paid";
  // 待付款
  if (status === "payment_uploaded" || (status === "submitted" && !ci.paymentConfirmed)) return "awaiting_payment";
  // 默认：待确认
  return "awaiting_confirm";
}

export interface BusinessStatusInfo {
  key: BusinessStatus;
  label: string;
  color: string;
  nextAction: string;
}

/** 业务状态展示信息：中文标签 + 颜色 + 下一步动作 */
export function getBusinessStatusInfo(project: ProjectLike): BusinessStatusInfo {
  const key = deriveBusinessStatus(project);
  return {
    key,
    label: BUSINESS_STATUS_LABELS[key],
    color: BUSINESS_STATUS_COLORS[key],
    nextAction: BUSINESS_STATUS_NEXT_ACTIONS[key],
  };
}

export interface DeliverableDownloadDecision {
  allowed: boolean;
  reason: string;
}

/** 交付文件下载门禁：交付中/已交付可下载；退款中/未付款/已取消/待确认锁定（测试工单豁免） */
export function evaluateDeliverableDownload(project: ProjectLike): DeliverableDownloadDecision {
  if (isTestProjectId(project.id)) {
    return { allowed: true, reason: "测试工单豁免" };
  }
  switch (deriveBusinessStatus(project)) {
    case "delivering":
    case "delivered":
      return { allowed: true, reason: "允许下载" };
    case "refunding":
      return { allowed: false, reason: "退款处理中，文件下载已锁定" };
    case "cancelled":
      return { allowed: false, reason: "订单已取消，无法下载" };
    case "awaiting_customer":
      return { allowed: false, reason: "待客户确认阶段仅提供预览，暂不开放下载（确认交付后可下载）" };
    case "awaiting_payment":
      return { allowed: false, reason: "未付款不能下载" };
    case "awaiting_confirm":
      return { allowed: false, reason: "订单尚未确认，无法下载" };
    case "paid":
    case "analyzing":
    case "generating":
    case "review":
      return { allowed: false, reason: "生产进行中，交付文件尚未生成" };
    case "modifying":
      return { allowed: false, reason: "修改中，下载已暂停；修改完成后可下载" };
    case "anomaly":
      return { allowed: false, reason: "项目异常，暂不开放下载" };
    case "archived":
      return { allowed: false, reason: "项目已归档，下载已关闭" };
    default:
      return { allowed: false, reason: "当前状态不支持下载" };
  }
}

/** 生成失败标记：内部技术状态或项目状态命中失败集合（TICKET-131 任务卡同源） */
export function hasFailureMarker(project: ProjectLike): boolean {
  return ANOMALY_STATUSES.has(getGenerationStatus(project)) || ANOMALY_STATUSES.has((project.status || "").trim());
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
export function nextPrimaryAction(project: ProjectLike): PrimaryAction {
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
export function technicalStatusItems(project: ProjectLike): { label: string; value: string }[] {
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
