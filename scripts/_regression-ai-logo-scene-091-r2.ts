/**
 * TICKET-091-R2 聚焦回归：LOGO 场景图改 AI 入景绘制（禁止代码硬贴）。
 *
 * 断言：
 * 1) 名片/信纸/包装提示词去掉「无 LOGO/空白底板」约束，改为 AI 画品牌 LOGO；
 * 2) 中文品牌字 ≥5 字默认省略（代码贴/不加），≤4 字可 AI 画；
 * 3) 全部场景路由 reference_anchor（AI 入景），不再默认 composite 硬贴；
 * 4) 门头/海报不再置 pending_074（executorStatus=ready）；
 * 5) vision-check 导出 runAIDrawnSceneCheck 且 worker 使用（LOGO 在场/
 *    无乱码中文/无水印/配色/场景完整）。
 */
import { readFileSync } from "node:fs";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passCount += 1; console.log(`PASS ${name}`); }
  else { failCount += 1; console.log(`FAIL ${name} ${detail}`); }
}

const repoRoot = new URL("../", import.meta.url);
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const visionSrc = readFileSync(new URL("src/lib/vision-check/index.ts", repoRoot), "utf8");

function main(): void {
  // 1) 去掉无 LOGO/空白底板约束，改 AI 画品牌 LOGO
  check("提示词不再含 blank unprinted surface/no logo 底板约束", !workerSrc.includes("blank unprinted surface, no text, no letters, no words, no symbols, no logo, no fake logo") && !workerSrc.includes("background plate only, reserved clean branding area"), "blank/no-logo constraint remains");
  check("提示词含 AI 入景绘制（brand logo mark printed）", workerSrc.includes("the brand logo mark printed") && workerSrc.includes("integrated lighting and shadows, professional brand application"), "ai-drawn prompt missing");
  check("名片/信纸/包装不再走 composite 默认", !/strategy:\s*'composite'/.test(workerSrc), "composite default remains");

  // 2) 中文品牌字 ≥5 省略
  // 工单 091-R4：中文品牌字 ≤4 字（百疗萃=3 字）允许 AI 入景，营销页加逐字核字门。
  check("中文品牌字 ≤4 可 AI 画、≥5 省略规则存在", workerSrc.includes("cnLen > 0 && cnLen <= 4 ?"), "name rule missing");
  check("门头/海报 AI 画 LOGO、代码贴「百疗萃」并核字", workerSrc.includes("with the brand logo mark displayed clearly on the signboard (clean blank area reserved for brand text)") && workerSrc.includes("overlayBrandTextOnScene({ background: generated.imageUrl, text: brandShort") && workerSrc.includes("'marketing-storefront', 'marketing-1'].includes(request.key)"), "sign/poster 核字门 missing");

  // 3) 全部场景 reference_anchor（AI 入景）
  check("全部场景 ai_drawn（z-turbo AI 入景）", workerSrc.includes("strategy: 'ai_drawn'") && workerSrc.includes("门头/海报原参考锚定（Flux2）在本机不稳"), "not all ai_drawn");
  check("AI 入景 z-turbo 批次存在", workerSrc.includes("aiDrawnSceneRequests = readySceneRequests.filter") && workerSrc.includes("SceneAIDrawn") && workerSrc.includes("aiGenerate({ request, seed })"), "ai_drawn batch missing");
  check("AI 入景不合格不再代码硬贴", workerSrc.includes("不再代码硬贴") && workerSrc.includes("保留 AI 图，标记 needs_review"), "paste fallback remains");

  // 4) 门头/海报不再 pending_074
  check("门头/海报 executorStatus=ready（无 candidate_074）", workerSrc.includes("executorStatus: 'ready'") && !/executorStatus:\s*isLargeVisual\s*\?\s*'candidate_074'/.test(workerSrc), "candidate_074 default remains");

  // 5) AI 入景验收
  check("vision-check 导出 runAIDrawnSceneCheck", visionSrc.includes("export async function runAIDrawnSceneCheck"), "missing export");
  check("AI 入景验收含 LOGO 在场/无乱码/无水印", visionSrc.includes("logoPresent") && visionSrc.includes("noGarbledChinese") && visionSrc.includes("noWatermark") && visionSrc.includes("paletteOk"), "check fields missing");
  check("worker 使用 runAIDrawnSceneCheck（含模型覆盖）", workerSrc.includes("runAIDrawnSceneCheck(candidate.generated.imageUrl, { models:") && workerSrc.includes("runAIDrawnSceneCheck(retried.imageUrl, { models:") && workerSrc.includes("VISION_FINE_MODEL"), "worker not wired");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
