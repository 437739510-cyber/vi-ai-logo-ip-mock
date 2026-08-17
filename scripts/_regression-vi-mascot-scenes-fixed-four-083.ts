import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consultationSchema } from "../src/lib/core/consultation-schema";
import { MASCOT_SCENES_MIN } from "../src/lib/vi-manual/mascot-assets";
import { buildMascotDesignBrief, buildMascotFullAssetPlan } from "../src/lib/vi-manual/mascot-design-brief";

const formPath = "src/components/client/ConsultationForm.tsx";
const schemaPath = "src/lib/core/consultation-schema.ts";
const submitPath = "src/app/api/submit/route.ts";
const briefPath = "src/lib/vi-manual/mascot-design-brief.ts";
const workerPath = "scripts/worker.mjs";
const plannerPath = "src/lib/vi-manual/page-planner.ts";
const renderPath = "src/lib/pptx/render-pptx.ts";
const testPath = "scripts/_regression-vi-mascot-scenes-fixed-four-083.ts";

const formSource = readFileSync(formPath, "utf8");
const schemaSource = readFileSync(schemaPath, "utf8");
const submitSource = readFileSync(submitPath, "utf8");
const briefSource = readFileSync(briefPath, "utf8");
const workerSource = readFileSync(workerPath, "utf8");
const plannerSource = readFileSync(plannerPath, "utf8");
const renderSource = readFileSync(renderPath, "utf8");
const testSource = readFileSync(testPath, "utf8");

let assertions = 0;

function check(value: unknown, message: string): asserts value {
  assert.ok(value, message);
  assertions += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  assertions += 1;
}

// 1. 表单移除场景图数量选择与页数承诺
check(!formSource.includes("场景图数量"), "083-1 表单不得再有场景图数量选择");
check(!formSource.includes("影响生成时间和手册页数"), "083-2 表单不得再承诺影响生成时间和手册页数");
check(!formSource.includes("mascotSceneCount"), "083-3 表单不得再有 mascotSceneCount 状态/注册/隐藏输入");
check(!formSource.includes("[3, 4, 6, 8, 12, 16]"), "083-4 表单不得再提供 3/4/6/8/12/16 选项");

// 2. schema 默认 4、无 3..16 范围限制（归一化由 submit/简报保证，schema 保持类型一致）
const sceneSchema = consultationSchema.pick({ mascotSceneCount: true });
check(sceneSchema.safeParse({}).success, "083-5 schema 缺失值可解析（默认/归一化由提交与简报层保证）");
equal(sceneSchema.parse({ mascotSceneCount: "" }).mascotSceneCount, "", "083-6 schema 空串保持允许（消费端归一化）");
check(schemaSource.includes(".default(4)"), "083-7 schema 默认值固定为 4");
check(!schemaSource.includes("min(3).max(16)"), "083-8 schema 不再限制 3..16 范围");
check(!schemaSource.includes("transform("), "083-9 schema 不使用 transform（保持 zodResolver 输入/输出类型一致）");

// 3. submit 固定 4
check(/mascotSceneCount:\s*4/.test(submitSource), "083-12 submit 固定写入 4");
check(!submitSource.includes("mascotSceneCount || 6"), "083-13 submit 不再默认 6");

// 4. 简报 sceneCount 固定 4
check(briefSource.includes("const sceneCount = 4;"), "083-14 简报 sceneCount 固定 4");
check(!briefSource.includes("? requestedSceneCount : 6"), "083-15 简报不再回退 6");
check(!briefSource.includes(">= 3 && requestedSceneCount"), "083-16 简报不再接受 3..16 范围");
const briefOld = buildMascotDesignBrief({
  companyName: "083测试品牌",
  industry: "restaurant",
  mascotSceneCount: 6,
});
equal(briefOld.sceneCount, 4, "083-17 简报旧值 6 归一化为 4");
const briefMissing = buildMascotDesignBrief({ companyName: "083测试品牌", industry: "restaurant" });
equal(briefMissing.sceneCount, 4, "083-18 简报缺失值默认为 4");

// 5. 资产计划恒为 4 场景
check(briefSource.includes("const targetSceneCount = 4;"), "083-19 资产计划 targetSceneCount 固定 4");
check(!briefSource.includes("Math.max(4, Math.min(16, brief.sceneCount))"), "083-20 资产计划不再有可变场景数逻辑");
const planOld = buildMascotFullAssetPlan({ brief: briefOld, styleAnchor: "标准识别款" });
equal(planOld.counts.scenes, 4, "083-21 资产计划 counts.scenes 恒为 4");
equal(planOld.scenes.length, 4, "083-22 资产计划 scenes 数组恒为 4");

// 6. 完整性门保持 4
equal(MASCOT_SCENES_MIN, 4, "083-23 完整性门 MASCOT_SCENES_MIN 保持 4");

// 7. 渲染端 2×2 网格完整展示 4 张
check(
  renderSource.includes('renderMascotRecordGrid(slide, opts.mascotScenes, "场景应用", startY, bc, 2)'),
  "083-24 渲染端 mascot-scenes 使用 2 列网格",
);
check(renderSource.includes("完整展示 4 个真实应用场景"), "083-25 渲染端完整展示 4 个真实场景");

// 8. Worker 保留字段传递（075-7 契约）
check(workerSource.includes("mascotSceneCount: clientInfo.mascotSceneCount"), "083-26 Worker 保留 mascotSceneCount 字段传递");

// 9. 无 IP 手册零 IP 页（IP 章节仅 include = requested && ready 时加入）
check(plannerSource.includes("const include = requested && ready;"), "083-27 规划器保留 IP 门禁 include=requested&&ready");
check(
  /if \(include\) \{\s*const mascotPages = await buildMascotChapter/.test(plannerSource),
  "083-28 IP 章节仅在 include 时加入（无 IP 零 IP 页）",
);
check(plannerSource.includes('"mascot-scenes"'), "083-29 规划器 IP 章节含 mascot-scenes 页");

// 10. 专项测试自身无类型抑制
const unsafeType = ["a", "n", "y"].join("");
const ignoreSuppression = ["@ts", "-ignore"].join("");
const noCheckSuppression = ["@ts", "-nocheck"].join("");
check(!new RegExp(`\\b${unsafeType}\\b`).test(testSource), "083-30 专项测试不得使用类型抑制关键字");
check(!testSource.includes(ignoreSuppression), "083-31 专项测试不得使用 ts-ignore 类抑制");
check(!testSource.includes(noCheckSuppression), "083-32 专项测试不得使用 ts-nocheck 类抑制");

console.log(`[083] PASS (${assertions} assertions)`);
