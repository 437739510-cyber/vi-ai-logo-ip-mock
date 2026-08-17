/**
 * 工单 062 回归：公仔场景“五要素提示词生成器 + 色板库 + 行业物件表 +
 * 公仔场景校验门”接线与结构断言（静态+纯函数，不生成图）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMascotSceneEval } from "../src/lib/vision-check";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");
const visionSrc = readFileSync(path.join(root, "src/lib/vision-check/index.ts"), "utf8");
const palette = JSON.parse(
  readFileSync(path.join(root, "src/lib/vi-manual/palette-rosegold.json"), "utf8"),
) as {
  industry_defaults?: string[];
  palette?: { hex: string; role?: string }[];
};

// 1. 五要素模板：渲染四件套 + 商业级 + 五官/成熟体态
check(
  "062-1 worker 场景提示词含渲染要素四件套",
  ["studio quality render", "volumetric lighting", "soft shadows", "extremely detailed"].every(
    (w) => workerSrc.includes(w),
  ),
  "MASCOT_SCENE_RENDER 四件套词",
);
check(
  "062-2 worker 含五官/成熟体态明确词",
  workerSrc.includes("clear facial features (eyes, nose, mouth visible)") &&
    workerSrc.includes("mature body proportions"),
  "facial features / mature body proportions",
);

// 2. 场景生成器与行业物件表
check(
  "062-3 worker 使用 buildMascotScenePrompts 构建场景提示词",
  workerSrc.includes("buildMascotScenePrompts(characterSpec, industryType, colorDesc)"),
  "scenes = buildMascotScenePrompts(...)",
);
check(
  "062-4 旧场景模板已移除（不再直接拼“3D Pixar ... storefront signage”）",
  !workerSrc.includes("full body mascot welcoming customers at the store entrance, storefront signage and entrance context"),
  "旧 storefront 字面量不存在",
);
check(
  "062-5 行业场景物件表覆盖 beauty/restaurant/beverage/floral/general",
  ["beauty:", "restaurant:", "beverage:", "floral:", "general:"].every((k) =>
    workerSrc.includes(`  ${k}`) || workerSrc.includes(k),
  ),
  "MASCOT_SCENE_OBJECTS 五行业键",
);

// 3. 色板库（动态读取，禁止手拍）
check(
  "062-6 色板库文件存在且 5 色含 hex",
  Array.isArray(palette.palette) && palette.palette.length === 5 && palette.palette.every((c) => c && c.hex),
  `palette count=${palette.palette?.length}`,
);
check(
  "062-7 色板含丽人行业默认声明",
  Array.isArray(palette.industry_defaults) && palette.industry_defaults.includes("beauty"),
  `industry_defaults=${palette.industry_defaults?.join(",")}`,
);
check(
  "062-8 worker 动态读取 palette-rosegold.json（非手拍）",
  workerSrc.includes("palette-rosegold.json") && workerSrc.includes("loadRosegoldPalette()"),
  "palette-rosegold.json 引用",
);
check(
  "062-9 色板按行业取（丽人默认玫瑰金，其余回退品牌色）",
  workerSrc.includes("mascotScenePaletteWords(industryType, colorDesc)") &&
    workerSrc.includes("isBeautyLikeIndustry"),
  "palette words 行业分支",
);

// 4. 公仔场景校验门接线
check(
  "062-10 vision-check 新增 runMascotSceneVisionCheck",
  visionSrc.includes("export async function runMascotSceneVisionCheck"),
  "runMascotSceneVisionCheck 导出",
);
check(
  "062-11 校验门含场景完整性与五官判定",
  visionSrc.includes("sceneComplete") && visionSrc.includes("faceComplete"),
  "sceneComplete/faceComplete",
);
check(
  "062-12 worker 场景项接入公仔场景校验门",
  workerSrc.includes("runMascotSceneVisionCheck") &&
    workerSrc.includes(`if (item.cat === "scene")`),
  "scene 项走 runMascotSceneVisionCheck",
);

// 5. 纯函数：场景评估 JSON 解析
const ok = parseMascotSceneEval('{"sceneComplete": true, "faceComplete": true}');
check(
  "062-13 parseMascotSceneEval 全真解析",
  ok !== null && ok.sceneComplete === true && ok.faceComplete === true,
  JSON.stringify(ok),
);
const bad = parseMascotSceneEval('```json\n{"sceneComplete": false, "faceComplete": true, "reason": "x"}\n```');
check(
  "062-14 parseMascotSceneEval 剥围栏解析 false",
  bad !== null && bad.sceneComplete === false && bad.faceComplete === true,
  JSON.stringify(bad),
);
check(
  "062-15 parseMascotSceneEval 垃圾输入返回 null",
  parseMascotSceneEval("not json at all") === null,
  "null",
);

const failed = checks.filter((c) => !c.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) {
  for (const f of failed) console.log("FAILED:", f.name);
}
process.exit(failed.length ? 1 : 0);
