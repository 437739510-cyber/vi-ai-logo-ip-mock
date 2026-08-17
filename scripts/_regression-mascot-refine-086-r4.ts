/**
 * TICKET-086-R4 聚焦回归：萃瑶成品细化契约。
 *
 * 断言：
 * 1) 公仔比例规则（标准 1:3.5 / Q 版 1:1.8，可配置）存在，plan 提示词含比例约束；
 * 2) 表情库统一 6 个（微笑/开心/安心/引导/俏皮/专注），每图单公仔约束存在；
 * 3) 硬编码清除：手册表情页/三视图比例文案改为数据驱动，不再写死 8 款/1:2.0；
 * 4) 场景一致性：worker 用三视图/正面作 reference（comfyGenerateReferenceAnchor）
 *    且提示词强制单公仔。
 */
import { readFileSync } from "node:fs";
import {
  MASCOT_EMOTION_NAMES,
  MASCOT_EMOTIONS_MIN,
  MASCOT_RATIO_RULES,
  resolveMascotRatioRule,
} from "../src/lib/vi-manual/mascot-assets";
import {
  buildMascotDesignBrief,
  buildMascotFullAssetPlan,
  type MascotDesignBrief,
} from "../src/lib/vi-manual/mascot-design-brief";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");
const plannerSrc = readFileSync(new URL("src/lib/vi-manual/page-planner.ts", repoRoot), "utf8");
const briefSrc = readFileSync(new URL("src/lib/vi-manual/mascot-design-brief.ts", repoRoot), "utf8");
const assetsSrc = readFileSync(new URL("src/lib/vi-manual/mascot-assets.ts", repoRoot), "utf8");

function makeBrief(): MascotDesignBrief {
  return buildMascotDesignBrief({
    companyName: "测试品牌",
    industry: "丽人:其他丽人",
    brandPersonality: "亲民温馨",
    mascotTypePref: ["character", "人类女性"],
    mascotStylePref: ["pixar_3d"],
    mascotPersonalityPref: ["温柔", "专业"],
    mascotColorHint: "玫瑰金 rose gold（#E8C4A0 #D4AF7A #B76E79）",
    mascotUsageScenes: ["门店迎宾", "会员服务", "产品包装", "社媒传播"],
  });
}

function main(): void {
  // 1) 比例规则
  check("比例规则存在 standard/q", !!MASCOT_RATIO_RULES.standard && !!MASCOT_RATIO_RULES.q, "missing");
  check("standard 头身比 1:3.5", MASCOT_RATIO_RULES.standard.headToBody === "1:3.5", MASCOT_RATIO_RULES.standard.headToBody);
  check("Q 版头身比 1:1.8", MASCOT_RATIO_RULES.q.headToBody === "1:1.8", MASCOT_RATIO_RULES.q.headToBody);
  check("默认比例=标准", resolveMascotRatioRule({}).id === "standard", resolveMascotRatioRule({}).id);
  check("Q 版偏好可配置", resolveMascotRatioRule({ mascotTypePref: ["Q版"] }).id === "q", "not q");
  check("显式 mascotRatio=q 优先", resolveMascotRatioRule({ mascotRatio: "q", mascotTypePref: ["character"] }).id === "q", "not q");

  const brief = makeBrief();
  const planStandard = buildMascotFullAssetPlan({ brief });
  const planQ = buildMascotFullAssetPlan({ brief, ratioRule: "q" });
  const joinedStd = planStandard.views.map((v) => v.prompt).join(" ") + planStandard.emotions.map((e) => e.prompt).join(" ") + planStandard.scenes.map((s) => s.prompt).join(" ");
  const joinedQ = planQ.views.map((v) => v.prompt).join(" ");
  check("plan 提示词含标准比例约束", joinedStd.includes("head-to-body ratio about 1:3.5"), "missing ratio");
  check("plan Q 版提示词含 Q 版比例约束", joinedQ.includes("head-to-body ratio about 1:1.8"), "missing q ratio");
  check("worker 传 ratioRule 给 plan", workerSrc.includes("ratioRule") && workerSrc.includes("buildMascotFullAssetPlan({ brief: mascotBrief, styleAnchor, characterSpec, ratioRule }"), "missing ratioRule wiring");

  // 2) 表情库 6×1
  const names: string[] = [...MASCOT_EMOTION_NAMES];
  check("表情库=6 个", names.length === 6, `count=${names.length}`);
  check("表情库名称=微笑/开心/安心/引导/俏皮/专注", ["微笑", "开心", "安心", "引导", "俏皮", "专注"].every((n) => names.includes(n)) && !names.includes("欢迎") && !names.includes("惊喜"), names.join("/"));
  check("表情去重", new Set(names).size === names.length, "dup");
  check("MASCOT_EMOTIONS_MIN=6", MASCOT_EMOTIONS_MIN === 6, String(MASCOT_EMOTIONS_MIN));
  check("plan 表情数=6", planStandard.emotions.length === 6, `count=${planStandard.emotions.length}`);
  check("worker 表情提示词强制单公仔", workerSrc.includes("Exactly one mascot character in frame") && workerSrc.includes("single subject only"), "missing single-subject constraint");

  // 3) 硬编码清除
  check("手册表情页不再写死 8 款/欢迎/惊喜", !plannerSrc.includes("至少8款") && !plannerSrc.includes("「欢迎」") && !plannerSrc.includes("「惊喜」"), "hardcode remains");
  check("手册表情页数据驱动（MASCOT_EMOTION_NAMES）", plannerSrc.includes("MASCOT_EMOTION_NAMES.join(\"/\")"), "missing data-driven names");
  check("手册三视图不再写死 1:2.0", !plannerSrc.includes("头身比 = 1:2.0") && !plannerSrc.includes("头身比固定 1:2.0"), "1:2.0 remains");
  check("手册三视图比例数据驱动（MASCOT_RATIO_RULES）", plannerSrc.includes("MASCOT_RATIO_RULES.standard.pageText") && plannerSrc.includes("MASCOT_RATIO_RULES.q.headToBody"), "missing ratio rules");
  check("render 表情门用 MASCOT_EMOTIONS_MIN", renderSrc.includes(">= MASCOT_EMOTIONS_MIN"), "missing min gate");
  check("render 表情网格不再写死 4×2/8 个", !renderSrc.includes("4×2 表情网格") && !renderSrc.includes("8 个中文表情"), "grid hardcode remains");
  check("design-brief 表情方向表为 6 项", (briefSrc.match(/^\s{4}[微笑安心引导俏皮专注开心]:/gm) || []).length >= 6 || planStandard.emotions.length === 6, "emotion direction map");
  check("worker 透传 mascotCharacterSetting 给 planPages", workerSrc.includes("mascotCharacterSetting: clientInfo.mascotCharacterSetting"), "missing setting passthrough");
  check("page-planner 显式角色设定优先", plannerSrc.includes("input.clientInfo.mascotCharacterSetting"), "missing explicit setting override");

  // 4) 场景一致性（reference 锁角色）
  check("worker 场景用正面作 reference 重生成", workerSrc.includes("comfyGenerateReferenceAnchor") && workerSrc.includes("referenceImage: viewImageData.front"), "missing scene reference");
  check("worker 场景提示词强制单公仔", workerSrc.includes("exactly one mascot character"), "missing single mascot in scene");
  check("assets 模块注释同步为 6 表情", assetsSrc.includes("emotions>=6") || assetsSrc.includes("emotions>=6 + scenes>=4"), "stale comment");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
