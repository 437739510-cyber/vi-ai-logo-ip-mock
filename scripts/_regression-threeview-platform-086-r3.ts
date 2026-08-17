/**
 * TICKET-086-R3 聚焦回归：三视图平台智能生成契约。
 *
 * 断言（源码级，覆盖 worker.mjs 三视图子流程）：
 * 1) 动态 CHAR_BASE + 动物特征清洗（鹿角教训：检出即删并明写无动物特征）；
 * 2) 负面词按公仔类型动态化（人形禁动物 / 动物形不禁动物+防串味 / 通用恒有）；
 * 3) 三视角分句（正对镜头 / 右转90度侧面 / 背对镜头），无「三视图/多视图」字样，
 *    每张强调「画面中只有一个角色」；
 * 4) 参数可配置（env 覆盖：Steps=4/CFG=3.5/1024²/种子大间隔/45s 冷却/重试≤3）；
 * 5) front reference 生成侧/背（Flux2 Klein 参考工作流 + ComfyUI input 写入）；
 * 6) 跨视图一致性 + combineThreeViewSheet 合拼 + 合拼版验收；
 * 7) 集成：processMascotFullGeneration 调用平台子流程，批次不再含 view 项，
 *    mascotAssets.threeView 落库；失败 stall（needs_review + 证据）。
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
const compositorSrc = readFileSync(new URL("src/lib/vi-manual/logo-scene-compositor.ts", repoRoot), "utf8");

function main(): void {
  // 1) 动态 CHAR_BASE + 动物特征清洗
  check("存在 cleanCharacterSpecOfAnimalFeatures", workerSrc.includes("function cleanCharacterSpecOfAnimalFeatures"), "missing");
  check("清洗删除鹿/角/兽耳关键词", /deer|antlers\?|horns\?|animal ears\?|鹿角|鹿耳|鹿人/.test(workerSrc), "missing animal keywords");
  check("清洗后明写无动物特征", workerSrc.includes("人类角色、无角、无兽耳、无动物特征"), "missing explicit no-animal");
  check("CHAR_BASE 来自角色描述/简报（非写死品牌）", workerSrc.includes("cleanCharacterSpecOfAnimalFeatures(characterSpec || mascotBrief.identity") && !/charBase\s*=\s*['"](?:萃瑶|百疗萃)/.test(workerSrc), "hardcoded brand in charBase");

  // 2) 负面词按类型动态化
  check("存在 buildMascotTypeNegativePrompt", workerSrc.includes("function buildMascotTypeNegativePrompt"), "missing");
  check("人形禁动物分支", workerSrc.includes("animal features, antlers, horns, animal ears, cat ears, bear"), "missing human branch");
  check("动物形不禁动物+防串味分支", workerSrc.includes("wrong species mixing, hybrid animal, mismatched species") && workerSrc.includes("human-like face on animal"), "missing animal branch");
  check("通用负面词恒有", workerSrc.includes("watermark, text, letters, logo, blurry, low quality, distorted, deformed"), "missing universal");

  // 3) 三视角分句
  check("front 分句：正对镜头全身正面", workerSrc.includes("Facing the camera directly, full-body front view"), "missing front");
  check("side 分句：右转90度严格侧影（仅一瞳）", workerSrc.includes("Body turned 90 degrees to the right, strict side profile with the face fully turned to the right (only one eye visible"), "missing side");
  check("back 分句：背对镜头不见脸", workerSrc.includes("strict back view showing only the back of the head and no face"), "missing back");
  const promptsBlock = workerSrc.slice(workerSrc.indexOf("const prompts = {"), workerSrc.indexOf("};", workerSrc.indexOf("const prompts = {")) + 3);
  check("三视角提示词强调单角色", promptsBlock.split("Exactly one character in the frame").length - 1 >= 3, "missing exactly-one");
  check("三视角提示词不含「三视图/多视图」", !promptsBlock.includes("三视图") && !promptsBlock.includes("多视图") && !/three[- ]?view/i.test(promptsBlock), "forbidden word");

  // 4) 参数可配置
  check("THREEVIEW_CFG 存在且默认 Steps=4/CFG=3.5/1024²", workerSrc.includes("THREEVIEW_STEPS") && workerSrc.includes("THREEVIEW_CFG") && workerSrc.includes("'1024x1024'") && workerSrc.includes("Number(process.env.THREEVIEW_STEPS) || 4") && workerSrc.includes("Number(process.env.THREEVIEW_CFG) || 3.5"), "config missing");
  check("种子大间隔非连续（12345/67890/11111）", workerSrc.includes("12345,67890,11111"), "seeds missing");
  check("45s 冷却可配置", workerSrc.includes("THREEVIEW_COOLDOWN_MS") && workerSrc.includes("45_000"), "cooldown missing");
  check("失败重试≤3 次", workerSrc.includes("THREEVIEW_MAX_ATTEMPTS") && workerSrc.includes("i >= THREEVIEW_CFG.maxAttempts"), "retry cap missing");

  // 5) front reference 生成侧/背
  check("存在 buildMascotViewReferenceWorkflow", workerSrc.includes("function buildMascotViewReferenceWorkflow"), "missing");
  check("参考图写入 ComfyUI input", workerSrc.includes("function writeReferenceImageToInput") && workerSrc.includes("COMFYUI_INPUT_DIR"), "missing ref write");
  check("用 comfyGenerateFromWorkflow 提交参考工作流", workerSrc.includes("comfyGenerateFromWorkflow(workflow)"), "missing submit");
  check("侧/背优先 front reference、重试回退文生图", workerSrc.includes("generateOne('side', true, front.imageUrl)") && workerSrc.includes("generateOne('back', true, front.imageUrl)") && workerSrc.includes("useRefThisTry = useReference && i === 0") && workerSrc.includes("mode=${useRefThisTry ? 'reference' : 'text2img'}"), "missing ref/t2i fallback");

  // 6) 一致性 + 合拼 + 合拼版验收
  check("调用 runThreeViewConsistencyCheck", workerSrc.includes("runThreeViewConsistencyCheck({ front: front.imageUrl"), "missing consistency");
  check("调用 combineThreeViewSheet（3152×1194）", workerSrc.includes("combineThreeViewSheet({ front: front.imageUrl, side: side.imageUrl, back: back.imageUrl, sheetWidth: 3152, sheetHeight: 1194 }") && compositorSrc.includes("export async function combineThreeViewSheet"), "missing combine");
  check("合拼版验收（validateMascotSheet / panelCount=3）", workerSrc.includes("async function validateMascotSheet") && workerSrc.includes("p.panelCount === 3") && workerSrc.includes("sameCharacterAcrossPanels"), "missing sheet check");

  // 7) 集成与 stall
  check("processMascotFullGeneration 调用平台子流程", workerSrc.includes("generateThreeViewsPlatform({") && workerSrc.includes("三视图平台子流程失败"), "missing integration");
  check("批次不再含 view 项", !workerSrc.includes('cat: "view", name: v.name'), "view still in batch");
  check("mascotAssets.threeView 落库", workerSrc.includes("threeView: threeViewUrl"), "threeView not stored");
  check("失败 stall 置 needs_review 并留证据", workerSrc.includes("threeViewPlatformEvidence") && workerSrc.includes('generationStatus: "needs_review"'), "stall missing");
  check("表情/场景提示词单角色约束", workerSrc.includes("Exactly one mascot character in frame") && workerSrc.includes("exactly one mascot character"), "single-char constraint missing");
  check("场景提示词角色描述先写（融合后缀存在）", workerSrc.includes("Full-body mascot placed INSIDE a complete recognizable commercial scene") && workerSrc.includes("no text, no watermark"), "scene prompt missing");

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
