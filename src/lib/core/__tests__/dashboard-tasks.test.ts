/**
 * TICKET-131-R35 工作台四任务卡聚合逻辑冒烟测试。
 * Run: npx tsx src/lib/core/__tests__/dashboard-tasks.test.ts
 */

import type { Project } from "@/types";
import {
  businessDaysAgo,
  deriveDashboardTaskCards,
  formatWaitDuration,
} from "../dashboard-tasks";

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

const p1AwaitingPaymentOld = project({
  id: "P1",
  status: "submitted",
  createdAt: "2026-08-10T11:27:32.951Z",
  updatedAt: "2026-08-10T11:27:32.951Z",
});

const p2AwaitingPaymentRecent = project({
  id: "P2",
  status: "payment_uploaded",
  createdAt: "2026-08-24T02:00:00.000Z",
  updatedAt: "2026-08-24T02:00:00.000Z",
  client_info: { paymentUploadedAt: "2026-08-24T02:00:00.000Z" },
});

const p3Review = project({
  id: "P3",
  status: "waiting_manual_review",
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

console.log("\n=== dashboard-tasks 聚合冒烟 ===\n");

// SLA 兜底：3 个工作日（跳过周末）
const cutoff = businessDaysAgo(new Date(NOW), 3);
assert(cutoff.toISOString() === "2026-08-20T10:00:00.000Z", "businessDaysAgo(3) 越过周末 = 2026-08-20");

const cards = deriveDashboardTaskCards(
  [p1AwaitingPaymentOld, p2AwaitingPaymentRecent, p3Review, p4FailedGen, p5CompletedOld, p6FailedStatus, p7Generating],
  { now: NOW },
);

const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));

// 待付款确认
assert(byKey.awaiting_payment.count === 2, "待付款确认数量 = 2");
assert(byKey.awaiting_payment.earliestWaitLabel === "14 天", "待付款最早等待 = 14 天");
assert(byKey.awaiting_payment.earliestReferenceAt === "2026-08-10T11:27:32.951Z", "待付款最早参考时间 = P1 提交时间");
assert(byKey.awaiting_payment.href === "/admin/projects?view=awaiting_payment", "待付款主操作 = /admin/projects?view=awaiting_payment");
assert(byKey.awaiting_payment.fallbackStatus === "payment_uploaded", "待付款兜底 status = payment_uploaded");

// 待人工审核
assert(byKey.review.count === 1, "待人工审核数量 = 1");
assert(byKey.review.earliestWaitLabel === "6 天", "待审核最早等待 = 6 天");
assert(byKey.review.href === "/admin/projects?view=review", "待审核主操作 = /admin/projects?view=review");

// 已逾期
assert(byKey.overdue.count === 2, "已逾期数量 = 2（P1/P3；已完成 P5 不计入）");
assert(byKey.overdue.earliestWaitLabel === "14 天", "已逾期最早等待 = 14 天");
assert(byKey.overdue.href === "/admin/projects?view=overdue", "已逾期主操作 = /admin/projects?view=overdue");

// 生成失败
assert(byKey.failed.count === 2, "生成失败数量 = 2（generationStatus 与 project.status 两个来源）");
assert(byKey.failed.earliestReferenceAt === "2026-08-23T08:00:00.000Z", "生成失败最早参考时间 = P6");
assert(byKey.failed.earliestWaitLabel === "2 天", "生成失败最早等待 = 2 天");
assert(byKey.failed.href === "/admin/projects?view=failed", "生成失败主操作 = /admin/projects?view=failed");

// 空列表：全部为 0 且等待时长为 null
const emptyCards = deriveDashboardTaskCards([], { now: NOW });
assert(emptyCards.length === 4 && emptyCards.every((c) => c.count === 0 && c.earliestWaitLabel === null), "空列表四卡均为 0 / 无等待时长");

// 时长格式化边界
assert(formatWaitDuration("2026-08-25T11:00:00.000Z", new Date(NOW)) === "刚刚", "未来参考时间显示「刚刚」");
assert(formatWaitDuration("not-a-date", new Date(NOW)) === "刚刚", "非法参考时间显示「刚刚」");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
