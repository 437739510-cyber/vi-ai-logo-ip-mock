/** 工单 077：Logo Worker 付款门纯函数。无数据库、网络或进程 I/O。 */

export type PaymentEvidenceSource = "persistent" | "legacy_paid" | "none";

export interface PaymentGateDecision {
  allowed: boolean;
  source: PaymentEvidenceSource;
  shouldPersist: boolean;
}

export interface PaymentRevocationDecision {
  allowed: boolean;
  reason: "not_started" | "production_started";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function cleanStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasAuditTimestamp(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

/** 持久布尔标记优先；旧项目只有明确 status=paid 时才可兼容升级。 */
export function evaluatePaymentGate(projectStatus: unknown, clientInfo: unknown): PaymentGateDecision {
  const ci = asRecord(clientInfo);
  if (ci.paymentConfirmed === true) {
    return {
      allowed: true,
      source: "persistent",
      shouldPersist: !hasAuditTimestamp(ci.paymentConfirmedAt),
    };
  }
  if (cleanStatus(projectStatus) === "paid") {
    return { allowed: true, source: "legacy_paid", shouldPersist: true };
  }
  return { allowed: false, source: "none", shouldPersist: false };
}

/** 写入或修复持久付款证据，同时清除“待付款”提示；不改变生成状态。 */
export function ensurePaymentConfirmed<T extends Record<string, unknown>>(
  clientInfo: T,
  confirmedAt: string,
): T & { paymentConfirmed: true; paymentConfirmedAt: string };
export function ensurePaymentConfirmed(clientInfo: unknown, confirmedAt: string): Record<string, unknown> {
  const source = asRecord(clientInfo);
  const { paymentRequired: _paymentRequired, ...rest } = source;
  const existingAt = hasAuditTimestamp(rest.paymentConfirmedAt) ? String(rest.paymentConfirmedAt) : confirmedAt;
  return {
    ...rest,
    paymentConfirmed: true,
    paymentConfirmedAt: existingAt,
  };
}

/** 未付款或合法撤销后的安全非生成状态；付款字段会被真正清除。 */
export function buildPaymentRequiredClientInfo(clientInfo: unknown): Record<string, unknown> {
  const source = asRecord(clientInfo);
  const {
    paymentConfirmed: _paymentConfirmed,
    paymentConfirmedAt: _paymentConfirmedAt,
    ...rest
  } = source;
  return {
    ...rest,
    generationStatus: "submitted",
    generationMessage: "payment_required",
    paymentRequired: true,
  };
}

/** 只有尚未进入任何实际生产阶段的订单才允许撤销付款。 */
export function evaluatePaymentRevocation(projectStatus: unknown, generationStatus: unknown): PaymentRevocationDecision {
  const project = cleanStatus(projectStatus);
  const generation = cleanStatus(generationStatus);
  const safeProjectStatuses = new Set(["", "submitted", "payment_uploaded", "paid"]);
  const safeGenerationStatuses = new Set(["", "submitted", "pending_logo", "payment_required"]);
  const allowed = safeProjectStatuses.has(project) && safeGenerationStatuses.has(generation);
  return { allowed, reason: allowed ? "not_started" : "production_started" };
}
