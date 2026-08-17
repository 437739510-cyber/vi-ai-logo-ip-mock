/**
 * 工单 066 回归：A 类 logo 场景提示词硬化 + 行业物料表
 * （餐饮/饮品/丽人/洗车/母婴/婚礼/宠物物料正确，洗车无餐纸，
 *  色板词/渲染要素/品牌名注入，与 B 类配套）。
 * 纯静态断言，不生成图、不调 API。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

check(
  "066-1 A 类物料表九族键齐全",
  ["restaurant:", "beverage:", "beauty:", "floral:", "car:", "mother_baby:", "wedding:", "pet:", "general:"].every(
    (k) => workerSrc.includes(k),
  ),
  "LOGO_SCENE_MATERIALS 九族",
);

const carBlock = workerSrc.match(/car: \{[^}]*\}/)?.[0] || "";
check(
  "066-2 洗车族物料正确（洗车券/会员卡/门店招牌，绝无餐纸餐盒）",
  carBlock.includes("car wash voucher and coupon flyer") &&
    carBlock.includes("auto care membership card") &&
    !carBlock.includes("meal box") &&
    !carBlock.includes("paper bag") &&
    !carBlock.includes("napkin"),
  "car 族无餐纸/餐盒",
);

check(
  "066-3 buildScenePrompts 接收原始行业与色板并硬化",
  workerSrc.includes("function buildScenePrompts(companyName, industryType, rawIndustry, profileColors)") &&
    workerSrc.includes("logoSceneFamily(rawIndustry, industryType)") &&
    workerSrc.includes("LOGO_SCENE_RENDER") &&
    workerSrc.includes("mascotScenePaletteWords(industryType, colorDesc)"),
  "五要素 + 行业族 + 色板词",
);

check(
  "066-4 logoSceneFamily 识别洗车/汽车美容",
  workerSrc.includes('return "car";') &&
    workerSrc.includes("/洗车|汽车美容|汽车服务|car wash|auto detail|auto care/i"),
  "car 识别正则",
);

check(
  "066-5 品牌名注入清晰（brand name ... printed clearly）",
  workerSrc.includes('with the brand name "${name}" and logo printed clearly'),
  "品牌名注入",
);

check(
  "066-6 A 类渲染要素四件套 + 商业摄影",
  ["professional product photography", "studio quality render", "volumetric lighting", "soft shadows", "extremely detailed"].every(
    (w) => workerSrc.includes(w),
  ),
  "LOGO_SCENE_RENDER",
);

check(
  "066-7 DeepSeek 建议提示词也硬化（自包含追加渲染+色板词）",
  workerSrc.includes("buildScenePromptsFromSuggestions") &&
    workerSrc.includes("${render}, ${paletteWords}") &&
    workerSrc.includes("rose gold pink brand color scheme"),
  "suggestions 硬化（自包含）",
);

check(
  "066-8 调用处传原始行业与品牌色板",
  workerSrc.includes("buildScenePrompts(companyName, industryType, rawIndustry, profileColors)") &&
    workerSrc.includes("const rawIndustry = clientInfo.industry || 'general';"),
  "调用传参",
);

const failed = checks.filter((c) => !c.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) {
  for (const f of failed) console.log("FAILED:", f.name);
}
process.exit(failed.length ? 1 : 0);
