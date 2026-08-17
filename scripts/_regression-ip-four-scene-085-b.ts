/**
 * TICKET-085-B-R1 聚焦回归（离线，不依赖外部服务）：
 * 1) worker.mjs 已接线 VISION_COARSE_MODEL / VISION_FINE_MODEL env 覆盖
 *    （默认值仍为 qwen2.5vl:3b / my-vl 不变）且接入 runSceneVisionCheck /
 *    runLogoFidelityVisionCheck；
 * 2) IP 场景交付门：测试单缺 A 类营销 → pending_074 且 ready=true；
 *    场景齐全 → ready=true 且无缺失（沿用 085-A-R2 契约口径）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateLogoSceneDeliveryGate, resolveSceneTextGate } from "../src/lib/vi-manual/logo-scene-compositor";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

const workerSrc = readFileSync(
  path.resolve("scripts/worker.mjs"),
  "utf8",
);
const compositorSrc = readFileSync(
  path.resolve("src/lib/vi-manual/logo-scene-compositor.ts"),
  "utf8",
);

check(
  "worker.mjs 定义 VISION_COARSE_MODEL env 覆盖",
  /const VISION_COARSE_MODEL = process\.env\.VISION_COARSE_MODEL \|\| undefined/.test(workerSrc),
);
check(
  "worker.mjs 定义 VISION_FINE_MODEL env 覆盖",
  /const VISION_FINE_MODEL = process\.env\.VISION_FINE_MODEL \|\| undefined/.test(workerSrc),
);
check(
  "runSceneVisionCheck 传入 coarseModel/fineModel 覆盖",
  /runSceneVisionCheck\(\{[\s\S]*?coarseModel: VISION_COARSE_MODEL[\s\S]*?fineModel: VISION_FINE_MODEL/.test(workerSrc),
);
check(
  // 工单 091-R2：参考锚定保真校验由 AI 入景验收替代（LOGO 在场/无乱码/无水印），
  // 验收模型仍支持 env 覆盖（VISION_FINE/COARSE_MODEL）。
  "runAIDrawnSceneCheck 传入模型覆盖（AI 入景验收）",
  (workerSrc.match(/runAIDrawnSceneCheck\(/g) || []).length >= 2 &&
    /runAIDrawnSceneCheck\([\s\S]*?VISION_FINE_MODEL/.test(workerSrc),
  `aiDrawnCalls=${(workerSrc.match(/runAIDrawnSceneCheck\(/g) || []).length}`,
);

const sceneKeys = [
  "stationery-1",
  "packaging-1",
  "packaging-2",
  "marketing-storefront",
  "marketing-1",
];
// 平台现状：marketing 槽为 reference_anchor 且 routeStatus=candidate_074
// （074 实机验收前不得释放），测试单降级通道显式标 pending_074。
function requestsFor(keys: string[]) {
  return keys.map((key) => ({
    key,
    routeStatus: key.startsWith("marketing") ? "candidate_074" : "ready",
    logoPlacement: {
      strategy: (key.startsWith("marketing") ? "reference_anchor" : "composite") as "reference_anchor" | "composite",
    },
  }));
}

const full = evaluateLogoSceneDeliveryGate(
  {
    requiredKeys: sceneKeys,
    sceneImages: {
      "stationery-1": "https://x/s1.png",
      "packaging-1": "https://x/p1.png",
      "packaging-2": "https://x/p2.png",
      "marketing-storefront": "https://x/m1.png",
      "marketing-1": "https://x/m2.png",
    },
    sceneVision: {
      "stationery-1": "passed",
      "packaging-1": "passed",
      "packaging-2": "passed",
      "marketing-storefront": "passed",
      "marketing-1": "passed",
    },
    requests: requestsFor(sceneKeys),
  },
  { allowMissingMarketingOnlyForTestOrder: true },
);
check("IP 场景齐全（测试单口径，marketing 仍 candidate_074）→ ready=true", full.ready === true, JSON.stringify(full));
check(
  "营销槽显式 pending_074 ×2",
  (full.missing || []).filter((m) => m.reason === "pending_074").length === 2,
  JSON.stringify(full.missing),
);

const downgraded = evaluateLogoSceneDeliveryGate(
  {
    requiredKeys: sceneKeys,
    sceneImages: {
      "stationery-1": "https://x/s1.png",
      "packaging-1": "https://x/p1.png",
      "packaging-2": "https://x/p2.png",
    },
    sceneVision: {
      "stationery-1": "passed",
      "packaging-1": "passed",
      "packaging-2": "passed",
      "marketing-storefront": "failed",
      "marketing-1": "failed",
    },
    requests: requestsFor(sceneKeys),
  },
  { allowMissingMarketingOnlyForTestOrder: true },
);
check("测试单缺 A 类营销 → ready=true（降级，pending_074）", downgraded.ready === true, JSON.stringify(downgraded));
check(
  "缺 A 类营销 → 显式 pending_074（marketing-storefront）",
  (downgraded.missing || []).some((m) => m.key === "marketing-storefront" && m.reason === "pending_074"),
  JSON.stringify(downgraded.missing),
);
check(
  "缺 A 类营销 → 显式 pending_074（marketing-1）",
  (downgraded.missing || []).some((m) => m.key === "marketing-1" && m.reason === "pending_074"),
  JSON.stringify(downgraded.missing),
);

// ---- TICKET-085-B-R2：场景文字门显式契约 ----
// 纯图形 logo（无文字）显式跳过；含文字路径照旧严格校验；expectedText 动态、不写死。
const brandName = "百疗萃养生馆";
const compositeNoTextPrompt =
  "Professional product photography of stationery set, background plate only, blank unprinted surface, no text, no letters, no words, no symbols, no logo";
const brandTextScenePrompt =
  `Professional product photography of a promotional poster with the brand name "${brandName}" and logo printed clearly`;

const gateNoTextLogoNoTextScene = resolveSceneTextGate({
  sceneKey: "stationery-1",
  prompt: compositeNoTextPrompt,
  mode: "chinese",
  companyName: brandName,
  logoHasText: false,
  logoText: "",
});
check(
  "无文字 logo + 无文字场景（composite）→ 文字门显式 mode=none（skipped）",
  gateNoTextLogoNoTextScene.mode === "none",
  JSON.stringify(gateNoTextLogoNoTextScene),
);
check(
  "无文字 logo + 无文字场景 → expectedText 为空",
  gateNoTextLogoNoTextScene.expectedText === "",
  JSON.stringify(gateNoTextLogoNoTextScene),
);
check(
  "无文字 logo + 无文字场景 → 跳过理由留痕",
  typeof gateNoTextLogoNoTextScene.reason === "string" && gateNoTextLogoNoTextScene.reason.length > 0,
  JSON.stringify(gateNoTextLogoNoTextScene),
);

const gateNoTextLogoBrandTextScene = resolveSceneTextGate({
  sceneKey: "marketing-1",
  prompt: brandTextScenePrompt,
  mode: "chinese",
  companyName: brandName,
  logoHasText: false,
  logoText: "",
});
check(
  "无文字 logo + 场景含品牌文字 → 仍严格校验（mode=chinese，非 none）",
  gateNoTextLogoBrandTextScene.mode === "chinese",
  JSON.stringify(gateNoTextLogoBrandTextScene),
);
check(
  "无文字 logo + 场景含品牌文字 → expectedText 为品牌名（动态传入，非写死）",
  gateNoTextLogoBrandTextScene.expectedText === brandName,
  JSON.stringify(gateNoTextLogoBrandTextScene),
);

const gateTextLogoComposite = resolveSceneTextGate({
  sceneKey: "packaging-1",
  prompt: compositeNoTextPrompt,
  mode: "chinese",
  companyName: brandName,
  logoHasText: true,
  logoText: "萃宝",
});
check(
  "有文字 logo + composite 场景 → 正常门（mode=chinese，不放行）",
  gateTextLogoComposite.mode === "chinese",
  JSON.stringify(gateTextLogoComposite),
);
check(
  "有文字 logo → expectedText 来自 logo OCR 文字（动态）",
  gateTextLogoComposite.expectedText.includes("萃宝"),
  JSON.stringify(gateTextLogoComposite),
);
check(
  "文字门 expectedText 不恒等于品牌名（复合来源，不写死）",
  gateTextLogoComposite.expectedText !== brandName,
  JSON.stringify(gateTextLogoComposite),
);

// ---- TICKET-085-B-R2：worker.mjs 接线与证据 ----
check(
  "worker.mjs 新增 detectLogoHasText(selectedLogoImage, visionModel)",
  /async function detectLogoHasText\(selectedLogoImage, visionModel\)/.test(workerSrc),
);
check(
  "worker.mjs detectLogoHasText 使用会话内缓存",
  /const logoTextCache = new Map\(\)/.test(workerSrc) && /logoTextCache\.(has|get|set)/.test(workerSrc),
);
check(
  "worker.mjs ollamaOcr 解析 Ollama JSON 信封（取 response 字段）",
  /JSON\.parse\(raw\)/.test(workerSrc) && /parsed\.response/.test(workerSrc),
);
check(
  "worker.mjs 场景批次 check 接线 resolveSceneTextGate（含 logoHasText）",
  /resolveSceneTextGate\(\{[\s\S]*?sceneKey[\s\S]*?logoHasText/.test(workerSrc),
);
check(
  "compositor 场景文字门显式 skipped 理由常量存在",
  compositorSrc.includes("scene_text_mode_none_no_text_layer_logo_no_text"),
);
check(
  "worker.mjs 文字门 skipped 理由（gate.reason）记入日志/结果",
  /gate\.reason/.test(workerSrc),
);
check(
  "worker.mjs isStorefrontPhoto 读取 VISION_COARSE_MODEL",
  /isStorefrontPhoto\([\s\S]*?model: VISION_COARSE_MODEL/.test(workerSrc),
);
check(
  "worker.mjs locateTextRegion 读取 VISION_FINE_MODEL",
  /locateTextRegion\([\s\S]*?model: VISION_FINE_MODEL/.test(workerSrc),
);
check(
  "worker.mjs 禁止写死品牌名「百疗萃养生馆」",
  !workerSrc.includes("百疗萃养生馆"),
);
check(
  "worker.mjs 无写死「POLP 无文字」式决策",
  !/POLP.{0,40}无文字|无文字.{0,40}POLP/.test(workerSrc),
);

console.log(`RESULT pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
