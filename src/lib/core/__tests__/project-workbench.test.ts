/**
 * TICKET-137-R34 统一业务状态机：14 态推导 + 付款/生产/交付规则约束测试。
 * Run: npx tsx src/lib/core/__tests__/project-workbench.test.ts
 */

import type { Project } from "@/types";
import {
  BUSINESS_STATUS_COLORS,
  BUSINESS_STATUS_LABELS,
  BUSINESS_STATUS_NEXT_ACTIONS,
  businessStatusFromProjectStatus,
  canStartProduction,
  deriveBusinessStatus,
  evaluateDeliverableDownload,
  getBusinessStatusInfo,
  isTestProjectId,
  type BusinessStatus,
} from "../project-workbench";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

function project(partial: Partial<Omit<Project, "status">> & { id: string; status: any }): Project {
  return {
    submissionId: "",
    assignedTo: null,
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
    timeline: [],
    ...partial,
  };
}

const ALL_14: BusinessStatus[] = [
  "awaiting_confirm", "awaiting_payment", "paid", "analyzing", "generating",
  "review", "awaiting_customer", "delivering", "delivered", "archived",
  "modifying", "refunding", "anomaly", "cancelled",
];

// ---- 14 态推导覆盖 ----
const pAwaitingConfirm = project({ id: "P-AC", status: "pending" });
const pAwaitingPayment = project({ id: "P-AP", status: "payment_uploaded" });
const pPaid = project({ id: "P-PAID", status: "paid", client_info: { generationStatus: "pending_logo" } });
const pAnalyzing = project({ id: "P-ANA", status: "paid", client_info: { generationStatus: "brand_analyzing", paymentConfirmed: true } });
const pGenerating = project({ id: "P-GEN", status: "paid", client_info: { generationStatus: "logo_generating", paymentConfirmed: true } });
const pReview = project({ id: "P-REV", status: "waiting_manual_review", client_info: { paymentConfirmed: true } });
const pAwaitingCustomer = project({ id: "P-AWC", status: "paid", client_info: { generationStatus: "logo_generated", brandProfile: {}, paymentConfirmed: true } });
const pDelivering = project({ id: "P-DEL", status: "paid", client_info: { generationStatus: "manual_review_complete", pptxResult: { url: "/x.pptx", pageCount: 20 }, paymentConfirmed: true } });
const pDelivered = project({ id: "P-DV", status: "delivered", client_info: { paymentConfirmed: true } });
const pCompleted = project({ id: "P-COMP", status: "completed", client_info: { paymentConfirmed: true } });
const pArchived = project({ id: "P-ARC", status: "delivered", client_info: { paymentConfirmed: true } });
(pArchived as Project & { deleted_at?: string | null }).deleted_at = "2026-08-22T00:00:00.000Z";
const pModifying = project({ id: "P-MOD", status: "modifying", client_info: { paymentConfirmed: true } });
const pRefunding = project({ id: "P-REF", status: "refunding", client_info: { paymentConfirmed: true } });
const pAnomaly = project({ id: "P-AN", status: "paid", client_info: { generationStatus: "mascot_failed", paymentConfirmed: true } });
const pCancelled = project({ id: "P-CAN", status: "cancelled" });

const deriveCases: Array<[Project, BusinessStatus, string]> = [
  [pAwaitingConfirm, "awaiting_confirm", "待确认"],
  [pAwaitingPayment, "awaiting_payment", "待付款"],
  [pPaid, "paid", "已付款"],
  [pAnalyzing, "analyzing", "分析中"],
  [pGenerating, "generating", "方案生成中"],
  [pReview, "review", "待人工审核"],
  [pAwaitingCustomer, "awaiting_customer", "待客户确认"],
  [pDelivering, "delivering", "交付中"],
  [pDelivered, "delivered", "已交付"],
  [pCompleted, "delivered", "已完成→已交付"],
  [pArchived, "archived", "已归档"],
  [pModifying, "modifying", "修改中"],
  [pRefunding, "refunding", "退款中"],
  [pAnomaly, "anomaly", "异常"],
  [pCancelled, "cancelled", "已取消"],
];

console.log("\n=== R34 业务状态机：14 态推导 ===\n");
const derivedSet = new Set<BusinessStatus>();
for (const [proj, expected, name] of deriveCases) {
  const actual = deriveBusinessStatus(proj);
  derivedSet.add(actual);
  assert(actual === expected, `${name}: deriveBusinessStatus = ${actual}`);
}
for (const s of ALL_14) {
  assert(derivedSet.has(s), `14 态全覆盖: ${s} 至少被一个 fixture 命中`);
}

// ---- 展示信息：标签/颜色/下一步动作非空且一致 ----
console.log("\n=== R34 展示信息 ===\n");
for (const s of ALL_14) {
  const label = BUSINESS_STATUS_LABELS[s];
  const color = BUSINESS_STATUS_COLORS[s];
  const next = BUSINESS_STATUS_NEXT_ACTIONS[s];
  assert(!!label && !!color && !!next, `${s}: label/color/nextAction 非空`);
}
const info = getBusinessStatusInfo(pGenerating);
assert(info.key === "generating" && info.label === "方案生成中", "getBusinessStatusInfo 返回 key/label");
assert(info.nextAction.length > 0 && info.color.length > 0, "getBusinessStatusInfo nextAction/color 非空");

// ---- 兜底映射（客户管理行） ----
console.log("\n=== businessStatusFromProjectStatus 兜底映射 ===\n");
assert(businessStatusFromProjectStatus("payment_uploaded") === "awaiting_payment", "payment_uploaded → 待付款");
assert(businessStatusFromProjectStatus("submitted") === "awaiting_payment", "submitted → 待付款");
assert(businessStatusFromProjectStatus("paid") === "paid", "paid → 已付款");
assert(businessStatusFromProjectStatus("delivered") === "delivered", "delivered → 已交付");
assert(businessStatusFromProjectStatus("cancelled") === "cancelled", "cancelled → 已取消");
assert(businessStatusFromProjectStatus("refunding") === "refunding", "refunding → 退款中");
assert(businessStatusFromProjectStatus("logo_generated") === "awaiting_customer", "logo_generated → 待客户确认");
assert(businessStatusFromProjectStatus("failed") === "anomaly", "failed → 异常");
assert(businessStatusFromProjectStatus(null) === "awaiting_confirm", "null → 待确认");

// ---- 生产门禁：未付款拒绝 / 测试豁免 / 已付款放行 ----
console.log("\n=== canStartProduction 生产门禁 ===\n");
const pUnpaid = project({ id: "P-UNPAID", status: "submitted" });
assert(!canStartProduction(pUnpaid), "未付款项目拒绝生产");
assert(canStartProduction(pPaid), "已付款项目允许生产");
assert(canStartProduction(pDelivered), "已交付项目允许生产（已付款）");
const pPaidByFlag = project({ id: "P-FLAG", status: "logo_generating", client_info: { paymentConfirmed: true } });
assert(canStartProduction(pPaidByFlag), "paymentConfirmed=true 允许生产");
const pTest = project({ id: "TEST/137-r34", status: "submitted" });
assert(canStartProduction(pTest), "TEST/ 前缀测试工单豁免");
assert(isTestProjectId("TEST/abc"), "isTestProjectId 识别 TEST/ 前缀");
assert(!isTestProjectId("P-123"), "isTestProjectId 拒绝普通 ID");

// ---- 下载门禁：交付中/已交付放行；退款/取消/待确认/未付款锁定；测试豁免 ----
console.log("\n=== evaluateDeliverableDownload 下载门禁 ===\n");
assert(evaluateDeliverableDownload(pDelivering).allowed, "交付中可下载");
assert(evaluateDeliverableDownload(pDelivered).allowed, "已交付可下载");
assert(!evaluateDeliverableDownload(pRefunding).allowed, "退款中锁定下载");
assert(!evaluateDeliverableDownload(pCancelled).allowed, "已取消锁定下载");
assert(!evaluateDeliverableDownload(pAwaitingCustomer).allowed, "待客户确认仅预览不下载");
assert(!evaluateDeliverableDownload(pAwaitingPayment).allowed, "未付款锁定下载");
assert(!evaluateDeliverableDownload(pAwaitingConfirm).allowed, "待确认锁定下载");
assert(evaluateDeliverableDownload(pTest).allowed, "TEST/ 测试工单下载豁免");
assert(evaluateDeliverableDownload(pRefunding).reason.length > 0, "锁定下载时返回中文原因");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
