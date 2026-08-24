/**
 * TICKET-132-R36 交付队列逻辑冒烟测试。
 * Run: npx tsx src/lib/core/__tests__/project-queue.test.ts
 */

import type { Project } from "@/types";
import {
  applyQueueView,
  getDeletedAt,
  inDateRange,
  isProjectOverdue,
  isSoftDeleted,
  matchesQueueSearch,
  normalizeQueueView,
  queueWaitReference,
  type QueueContext,
} from "../project-queue";
import { businessDaysAgo } from "../dashboard-tasks";

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

function project(partial: Partial<Project> & Pick<Project, "id" | "status">): Project {
  const now = "2026-08-25T10:00:00.000Z";
  return {
    submissionId: "",
    assignedTo: null,
    createdAt: now,
    updatedAt: now,
    timeline: [],
    ...partial,
  };
}

const NOW = "2026-08-25T10:00:00.000Z";
const CTX: QueueContext = { now: NOW };

const p1AwaitingOld = project({
  id: "P1",
  submissionId: "SBM-1",
  status: "submitted",
  clientName: "老碗香社区面馆",
  createdAt: "2026-08-10T11:27:32.951Z",
  updatedAt: "2026-08-10T11:27:32.951Z",
});

const p2AwaitingRecent = project({
  id: "P2",
  submissionId: "SBM-2",
  status: "payment_uploaded",
  industry: "餐饮",
  clientName: "茶语时光",
  createdAt: "2026-08-24T02:00:00.000Z",
  updatedAt: "2026-08-24T02:00:00.000Z",
  client_info: {
    paymentUploadedAt: "2026-08-24T02:00:00.000Z",
    paidPlan: "标准版",
    assignedTo: { name: "王主管" },
  },
});

const p3Review = project({
  id: "P3",
  status: "waiting_manual_review",
  studentName: "小明",
  createdAt: "2026-08-19T08:00:00.000Z",
  updatedAt: "2026-08-19T08:00:00.000Z",
});

const p4FailedGen = project({
  id: "P4",
  status: "ai_analysis",
  createdAt: "2026-08-24T09:00:00.000Z",
  updatedAt: "2026-08-24T09:00:00.000Z",
  client_info: { generationStatus: "mascot_failed" },
});

const p5CompletedOld = project({
  id: "P5",
  status: "completed",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

const p6FailedStatus = project({
  id: "P6",
  status: "failed",
  createdAt: "2026-08-23T08:00:00.000Z",
  updatedAt: "2026-08-23T08:00:00.000Z",
});

const p7Generating = project({
  id: "P7",
  status: "paid",
  createdAt: "2026-08-25T09:00:00.000Z",
  updatedAt: "2026-08-25T09:00:00.000Z",
  client_info: { generationStatus: "designing" },
});

const p8ReadyDeliver = project({
  id: "P8",
  status: "paid",
  createdAt: "2026-08-24T10:00:00.000Z",
  updatedAt: "2026-08-24T10:00:00.000Z",
  client_info: {
    generationStatus: "manual_review_complete",
    pptxResult: { url: "/download/p8.pptx", pageCount: 20 },
  },
});

const p9AwaitingCustomer = project({
  id: "P9",
  status: "paid",
  createdAt: "2026-08-24T11:00:00.000Z",
  updatedAt: "2026-08-24T11:00:00.000Z",
  client_info: {
    generationStatus: "logo_generated",
    brandProfile: {},
  },
});

const p10Archived = project({
  id: "P10",
  submissionId: "SBM-10",
  status: "submitted",
  clientName: "已归档客户",
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
});
(p10Archived as Project & { deleted_at?: string | null }).deleted_at = "2026-08-22T00:00:00.000Z";

const p11Pending = project({
  id: "P11",
  status: "confirmed",
  createdAt: "2026-08-24T12:00:00.000Z",
  updatedAt: "2026-08-24T12:00:00.000Z",
});

const p12ReviewAssigned = project({
  id: "P12",
  status: "waiting_manual_review",
  clientName: "小林奶茶",
  createdAt: "2026-08-24T13:00:00.000Z",
  updatedAt: "2026-08-24T13:00:00.000Z",
  client_info: { assignedTo: { name: "李雷" } },
});

const ALL = [
  p1AwaitingOld,
  p2AwaitingRecent,
  p3Review,
  p4FailedGen,
  p5CompletedOld,
  p6FailedStatus,
  p7Generating,
  p8ReadyDeliver,
  p9AwaitingCustomer,
  p10Archived,
  p11Pending,
  p12ReviewAssigned,
];

const ids = (list: Project[]): string[] => list.map((p) => p.id);

console.log("\n=== project-queue 视图/搜索/软删除 冒烟 ===\n");

// ---- 软删除 ----
assert(getDeletedAt(p10Archived) === "2026-08-22T00:00:00.000Z", "isSoftDeleted 读取 deleted_at");
assert(isSoftDeleted(p10Archived), "已归档项目判定为软删除");
assert(!isSoftDeleted(p1AwaitingOld), "普通项目非软删除");

// ---- 视图过滤 ----
assert(ids(applyQueueView(ALL, "all", CTX)).includes("P10") === false, "all 视图排除软删除");
assert(ids(applyQueueView(ALL, "archived", CTX)).length === 1, "archived 视图只含软删除");
assert(ids(applyQueueView(ALL, "archived", CTX))[0] === "P10", "archived 视图内容 = P10");
assert(ids(applyQueueView(ALL, "awaiting_payment", CTX)).sort().join() === ["P1", "P2"].sort().join(), "待付款视图 = P1/P2");
assert(ids(applyQueueView(ALL, "review", CTX)).sort().join() === ["P3", "P12"].sort().join(), "待人工审核视图 = P3/P12");
assert(ids(applyQueueView(ALL, "awaiting_customer", CTX)).join() === "P9", "待客户确认视图 = P9");
assert(ids(applyQueueView(ALL, "ready_deliver", CTX)).join() === "P8", "待交付视图 = P8");
assert(ids(applyQueueView(ALL, "anomaly", CTX)).sort().join() === ["P4", "P6"].sort().join(), "异常视图 = P4/P6（失败标记）");
assert(ids(applyQueueView(ALL, "failed", CTX)).sort().join() === ["P4", "P6"].sort().join(), "R35 failed 视图与异常同源 = P4/P6");
assert(ids(applyQueueView(ALL, "overdue", CTX)).sort().join() === ["P1", "P3"].sort().join(), "已逾期视图 = P1/P3（终态 P5 不计）");
assert(ids(applyQueueView(ALL, "my_todos", CTX)).sort().join() === ["P1", "P2", "P3", "P4", "P6", "P8", "P9", "P11", "P12"].sort().join(), "我的待办（管理员）= 可处理状态集合（含异常 P4/P6）");
assert(ids(applyQueueView(ALL, "my_todos", { ...CTX, currentUser: { role: "student", name: "李雷" } })).join() === "P12", "我的待办（学生李雷）= 仅分配给自己的 P12");

// ---- 排序：待办/逾期按等待时长降序（最久在前） ----
const todosSorted = ids(applyQueueView(ALL, "my_todos", CTX));
assert(todosSorted[0] === "P1", "我的待办按等待时长降序，首位 = 最久的 P1");
const overdueSorted = ids(applyQueueView(ALL, "overdue", CTX));
assert(overdueSorted[0] === "P1", "已逾期按等待时长降序，首位 = 最久的 P1");

// ---- R35 兼容 view 解析 ----
assert(normalizeQueueView("overdue") === "overdue", "normalizeQueueView(overdue) = overdue");
assert(normalizeQueueView("failed") === "failed", "normalizeQueueView(failed) = failed");
assert(normalizeQueueView("review") === "review", "normalizeQueueView(review) = review");
assert(normalizeQueueView("bogus") === "all", "非法 view 回退 all");
assert(normalizeQueueView(null) === "all", "空 view 回退 all");

// ---- 搜索 ----
const PHONES = new Map<string, string>([
  ["P1", "13800001234"],
  ["P2", "13900005678"],
]);
assert(matchesQueueSearch(p1AwaitingOld, "老碗", PHONES), "搜索客户名命中");
assert(matchesQueueSearch(p1AwaitingOld, "1234", PHONES), "搜索手机号后四位命中（LIKE 后缀）");
assert(matchesQueueSearch(p1AwaitingOld, "13800001234", PHONES), "搜索完整手机号命中");
assert(!matchesQueueSearch(p1AwaitingOld, "9999", PHONES), "手机号后四位不匹配则排除");
assert(matchesQueueSearch(p2AwaitingRecent, "餐饮", PHONES), "搜索行业命中");
assert(matchesQueueSearch(p2AwaitingRecent, "标准版", PHONES), "搜索套餐命中");
assert(matchesQueueSearch(p2AwaitingRecent, "王主管", PHONES), "搜索负责人命中");
assert(matchesQueueSearch(p3Review, "小明", PHONES), "搜索学生命中");
assert(matchesQueueSearch(p1AwaitingOld, "P1", PHONES), "搜索项目编号命中");

// ---- 日期范围（按 createdAt） ----
assert(inDateRange(p1AwaitingOld, "2026-08-01", "2026-08-15"), "日期范围包含 P1");
assert(!inDateRange(p2AwaitingRecent, "2026-08-01", "2026-08-15"), "日期范围排除 P2");
assert(inDateRange(p2AwaitingRecent, "2026-08-24", "2026-08-24"), "日期范围单日命中 P2（含当天）");

// ---- 逾期 / SLA（兜底 3 工作日，与 R35 同口径） ----
const cutoff = businessDaysAgo(new Date(NOW), 3);
assert(cutoff.toISOString() === "2026-08-20T10:00:00.000Z", "businessDaysAgo(3) 跨周末 = 2026-08-20");
assert(isProjectOverdue(p1AwaitingOld, CTX), "P1 逾期");
assert(!isProjectOverdue(p5CompletedOld, CTX), "终态（completed）不计逾期");
assert(!isProjectOverdue(p4FailedGen, CTX), "P4 未到 SLA 不计逾期");

// ---- 等待参考时间（待付款用 paymentUploadedAt||createdAt） ----
assert(queueWaitReference("awaiting_payment", p2AwaitingRecent) === "2026-08-24T02:00:00.000Z", "待付款等待起点 = paymentUploadedAt");

// ---- 空列表 ----
assert(applyQueueView([], "all", CTX).length === 0, "空列表 all 视图 = 0");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
