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
  appendAiReviewNote,
  buildAiGenerationArchive,
  canStartProduction,
  deriveBusinessStatus,
  evaluateDeliverableDownload,
  getAiReviewNotes,
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

// ---- TICKET-137-R40：AI 生成档案只读映射 + 我的意见写入 ----
console.log("\n=== AI 生成档案（TICKET-137-R40） ===\n");

const archiveClientInfo = {
  companyName: "老碗香社区面馆",
  industry: "美食",
  mainProducts: "手擀面",
  generationStatus: "logo_generated",
  generationMessage: "Logo 生成完成",
  brandProfile: {
    brandPositioning: "社区温暖面馆",
    visualStyleSuggestion: "温暖亲切实景风",
    brandToneKeywords: ["温暖", "匠心"],
    colorPalette: [{ name: "品牌主色", hex: "#37474F", meaning: "沉稳专业" }],
    analysisStatus: "completed",
    sceneImageSuggestions: [
      { zh: "店面门头应用", en: "storefront sign with logo" },
      { zh: "宣传海报应用", en: "promotional poster with logo" },
    ],
    logoGenerationResults: [
      { index: 0, prompt: "方案A：老碗香现代扁平 logo", imageUrl: "/a.png" },
      { index: 1, prompt: "方案B：老碗香简约 logo", imageUrl: "/b.png" },
    ],
    selectedLogo: { index: 1, imageUrl: "/b.png" },
  },
  logoGenerationStatus: {
    total: 2,
    completed: 2,
    results: [
      { index: 0, prompt: "方案A" },
      { index: 1, prompt: "方案B" },
    ],
  },
};

const archiveSub = {
  companyName: "老碗香社区面馆",
  clientName: "测试用户-085A",
  phone: "13413049752",
  province: "广东省",
  city: "深圳市",
  industry: "美食",
  mainProducts: "手擀面、刀削面",
  businessForm: "实体店",
  description: "社区老店，温暖接地气",
  brandVision: "成为社区最温暖的面馆",
};

const archive = buildAiGenerationArchive({ clientInfo: archiveClientInfo, submission: archiveSub });
assert(archive.submission.province === "广东省" && archive.submission.city === "深圳市", "档案：地区来自 submission");
assert(archive.submission.mainProducts === "手擀面、刀削面", "档案：主营产品来自 submission");
assert(archive.submission.companyName === "老碗香社区面馆", "档案：公司名称来自 submission");
assert(archive.brandProfile.brandPositioning === "社区温暖面馆", "档案：品牌定位语");
assert(archive.brandProfile.visualStyleSuggestion === "温暖亲切实景风", "档案：视觉风格建议");
assert(archive.brandProfile.brandToneKeywords.length === 2, "档案：品牌调性关键词");
assert(archive.brandProfile.colorPalette.length === 1 && archive.brandProfile.colorPalette[0].hex === "#37474F", "档案：品牌色板");
assert(archive.brandProfile.sceneSuggestions.length === 2, "档案：场景提示词数量");
assert(archive.brandProfile.sceneSuggestions[0].zh === "店面门头应用" && archive.brandProfile.sceneSuggestions[0].en === "storefront sign with logo", "档案：场景提示词 zh/en");
assert(archive.logoPrompts.length === 2, "档案：LOGO 提示词来自 brandProfile.logoGenerationResults");
assert(archive.logoPrompts[0].index === 0 && archive.logoPrompts[1].index === 1, "档案：LOGO 提示词 index");
assert(archive.logoPrompts[0].prompt.indexOf("方案A") >= 0, "档案：LOGO 提示词内容");
assert(archive.logoPrompts[1].selected === true, "档案：LOGO 选中标记（selectedLogo.index）");
assert(archive.logoPrompts[0].selected === false, "档案：未选中方案无选中标记");
assert(archive.generation.logoTotal === 2 && archive.generation.logoCompleted === 2, "档案：LOGO 生成进度 total/completed");
assert(archive.generation.generationStatus === "logo_generated", "档案：generationStatus");
assert(archive.generation.generationMessage === "Logo 生成完成", "档案：generationMessage");

// logoGenerationStatus.results 兜底（brandProfile.logoGenerationResults 缺失时）
const archiveFallback = buildAiGenerationArchive({
  clientInfo: { ...archiveClientInfo, brandProfile: { ...archiveClientInfo.brandProfile, logoGenerationResults: null } },
  submission: archiveSub,
});
assert(archiveFallback.logoPrompts.length === 2, "档案：LOGO 提示词兜底 logoGenerationStatus.results");
assert(archiveFallback.logoPrompts[0].prompt === "方案A", "档案：兜底结果含 prompt");

// 空数据安全回退
const archiveEmpty = buildAiGenerationArchive({ clientInfo: {}, submission: null });
assert(archiveEmpty.submission.companyName === "" && archiveEmpty.submission.province === "", "档案：空 submission 安全回退");
assert(archiveEmpty.brandProfile.brandPositioning === "" && archiveEmpty.brandProfile.sceneSuggestions.length === 0, "档案：空 brandProfile 安全回退");
assert(archiveEmpty.logoPrompts.length === 0, "档案：空 LOGO 提示词安全回退");
assert(archiveEmpty.generation.logoTotal === 0 && archiveEmpty.generation.logoCompleted === 0, "档案：空生成进度安全回退");

// 我的意见写入（纯函数，不触库）
const notesBefore = getAiReviewNotes(archiveClientInfo);
assert(notesBefore.length === 0, "意见：初始为空");
const ciWithNote = appendAiReviewNote(archiveClientInfo, "  提示词建议更口语化  ", "admin");
const notesAfter = getAiReviewNotes(ciWithNote);
assert(notesAfter.length === 1, "意见：追加一条");
assert(notesAfter[0].note === "提示词建议更口语化", "意见：note 去除首尾空白");
assert(notesAfter[0].operator === "admin", "意见：operator 默认 admin");
assert(typeof notesAfter[0].createdAt === "string" && notesAfter[0].createdAt.length > 0, "意见：createdAt 生成");
assert(getAiReviewNotes(archiveClientInfo).length === 0, "意见：append 不改原 client_info");
const ciWithTwo = appendAiReviewNote(ciWithNote, "第二条意见", "ops");
const notesTwo = getAiReviewNotes(ciWithTwo);
assert(notesTwo.length === 2 && notesTwo[1].note === "第二条意见", "意见：多条顺序追加");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
