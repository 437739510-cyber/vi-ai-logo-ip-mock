/**
 * 工单 050 回归：客户查看页公仔区（/api/view 数据契约 + 样稿过滤 + 组件真实图）。
 * 不依赖 Ollama/ComfyUI/网络。
 * 运行：npx tsx scripts/_regression-vi-view-mascot-050.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { filterMascotSamples } from "../src/lib/vi-manual/customer-logo-filter";

const routeSrc = fs.readFileSync("src/app/api/view/route.ts", "utf8");
const sectionSrc = fs.readFileSync("src/components/client/MascotSection.tsx", "utf8");
const retBlock = routeSrc.slice(routeSrc.indexOf("success: true"));

test("050-1 样稿过滤：vision passed + 顶层 status failed 仍展示（样稿a场景）", () => {
  const samples = [
    { id: "a", label: "经典款", imageUrl: "https://x/a.png", status: "failed", vision: { status: "passed" } },
  ];
  assert.deepEqual(filterMascotSamples(samples).map((s) => s.id), ["a"]);
});

test("050-2 样稿过滤：needs_review / error / 无图 隐藏，skipped 保留", () => {
  const samples = [
    { id: "a", imageUrl: "https://x/a.png", vision: { status: "needs_review" } },
    { id: "b", imageUrl: "https://x/b.png", error: "boom" },
    { id: "c", imageUrl: "" },
    { id: "d", imageUrl: "https://x/d.png", vision: { status: "skipped" } },
  ];
  assert.deepEqual(filterMascotSamples(samples).map((s) => s.id), ["d"]);
});

test("050-3 /api/view 返回 sanitized client_info，不泄露 viewPassword", () => {
  assert.ok(retBlock.includes("client_info"));
  assert.ok(routeSrc.includes("mascotSamples"));
  assert.ok(routeSrc.includes("mascotSelectedId"));
  assert.ok(!retBlock.includes("viewPassword"));
});

test("050-4 /api/view 返回 submission.wantMascot 供页面条件", () => {
  assert.ok(retBlock.includes("wantMascot"));
});

test("050-5 MascotSection 使用真实样稿图且无硬编码占位描述", () => {
  assert.ok(sectionSrc.includes("s.imageUrl"));
  assert.ok(sectionSrc.includes("mascotSamples"));
  assert.ok(!sectionSrc.includes("米白椰肉"));
  assert.ok(!sectionSrc.includes("绿色椰青"));
  assert.ok(!sectionSrc.includes("围裙匠人风"));
});
