/**
 * TICKET-086-R1 聚焦回归：IP 应用行业规则固化 + 平台级根治接线。
 *
 * 断言：
 * 1) 行业规则表：丽人/美业规则集（线上/线下触点）、通用回退；
 *    美容/餐饮/茶饮/零售三页物料映射正确；规则文件无品牌名写死；
 * 2) 目录顺序：render-pptx 的 TOC_SECTION_ORDER 为
 *    基础规范 → 应用系统 → 收尾 → IP公仔（各一次）；
 * 3) P0 接线：compositor 导出 overlayBrandTextOnScene / pasteLogoOnScene；
 *    worker.mjs 用 comfyGenerateReferenceAnchor 做 IP 场景参考图重生成、
 *    贴 LOGO、叠文字；extractLogoElements 对提示词式长句保持空（触发视觉兜底）；
 * 4) P1/P2 接线：render-pptx 含 slogan 展示、DPI 数值表、LOGO 元素释义、
 *    IP 数字应用口径、行业物料查表；
 * 5) 无写死：行业规则文件与 worker/compositor/render-pptx 均不含「百疗萃」「萃瑶」。
 */
import { readFileSync } from "node:fs";
import {
  getIndustryIpApplicationRules,
  getIndustrySceneMaterials,
  resolveIndustryRuleKey,
} from "../src/lib/vi-manual/industry-ip-application-rules";
import { extractLogoElements } from "../src/lib/vi-manual/brand-visual-rules";

let passCount = 0;
let failCount = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passCount += 1;
    console.log(`PASS ${name}`);
  } else {
    failCount += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

const repoRoot = new URL("../", import.meta.url);
const rulesSrc = readFileSync(new URL("src/lib/vi-manual/industry-ip-application-rules.ts", repoRoot), "utf8");
const workerSrc = readFileSync(new URL("scripts/worker.mjs", repoRoot), "utf8");
const compositorSrc = readFileSync(new URL("src/lib/vi-manual/logo-scene-compositor.ts", repoRoot), "utf8");
const renderSrc = readFileSync(new URL("src/lib/pptx/render-pptx.ts", repoRoot), "utf8");

function main(): void {
  // 1) 行业规则表
  const beauty = getIndustryIpApplicationRules("丽人:其他丽人");
  check("丽人规则 industryKey=beauty", beauty.industryKey === "beauty", beauty.industryKey);
  check("丽人线上触点（头像/表情包/配图）", beauty.online.some((x) => x.includes("头像")) && beauty.online.some((x) => x.includes("表情包")), beauty.online.join(","));
  check("丽人线下触点（会员卡/护肤品包装/购物袋）", beauty.offline.some((x) => x.includes("会员卡")) && beauty.offline.some((x) => x.includes("护肤品包装")) && beauty.offline.some((x) => x.includes("购物袋")), beauty.offline.join(","));
  const generic = getIndustryIpApplicationRules("餐饮");
  check("其他行业回退通用规则", generic.industryKey === "generic", generic.industryKey);
  check("行业归一化（美甲→beauty）", resolveIndustryRuleKey("美甲") === "beauty", resolveIndustryRuleKey("美甲"));
  check("行业归一化（面馆→restaurant）", resolveIndustryRuleKey("面馆") === "restaurant", resolveIndustryRuleKey("面馆"));

  const beautyPkg = getIndustrySceneMaterials("丽人:其他丽人", "packaging") || [];
  check("美容包装物料含产品包装盒/购物袋", beautyPkg.some((s) => s.name.includes("包装盒")) && beautyPkg.some((s) => s.name.includes("购物袋")), beautyPkg.map((s) => s.name).join(","));
  const beautySta = getIndustrySceneMaterials("丽人:其他丽人", "stationery") || [];
  check("美容应用物料含项目价目表/会员卡相关", beautySta.some((s) => s.name.includes("价目表")), beautySta.map((s) => s.name).join(","));
  const restaurantPkg = getIndustrySceneMaterials("餐饮", "packaging") || [];
  check("餐饮包装物料含餐盒", restaurantPkg.some((s) => s.name.includes("餐盒")), restaurantPkg.map((s) => s.name).join(","));
  const beveragePkg = getIndustrySceneMaterials("茶饮", "packaging") || [];
  check("茶饮包装物料含杯套/手提袋", beveragePkg.some((s) => s.name.includes("杯套")) && beveragePkg.some((s) => s.name.includes("手提袋")), beveragePkg.map((s) => s.name).join(","));
  const retailPkg = getIndustrySceneMaterials("零售", "packaging") || [];
  check("零售包装物料含包装盒/购物袋", retailPkg.some((s) => s.name.includes("包装盒")) && retailPkg.some((s) => s.name.includes("购物袋")), retailPkg.map((s) => s.name).join(","));
  check("未命中行业回退 null（通用场景）", getIndustrySceneMaterials("科技", "packaging") === null, String(getIndustrySceneMaterials("科技", "packaging")));

  // 2) 目录顺序
  const tocOrder = renderSrc.match(/TOC_SECTION_ORDER[^=]*=\s*\[([^\]]+)\]/);
  const orderText = tocOrder ? tocOrder[1] : "";
  check(
    "目录顺序=基础规范→应用系统→收尾→IP公仔",
    orderText.indexOf("基础规范") < orderText.indexOf("应用系统") &&
      orderText.indexOf("应用系统") < orderText.indexOf("收尾") &&
      orderText.indexOf("收尾") < orderText.indexOf("IP公仔"),
    orderText,
  );
  check(
    "目录顺序数组无重复分区",
    (orderText.match(/基础规范/g) || []).length === 1 &&
      (orderText.match(/应用系统/g) || []).length === 1 &&
      (orderText.match(/收尾/g) || []).length === 1 &&
      (orderText.match(/IP公仔/g) || []).length === 1,
    orderText,
  );

  // 3) P0 接线
  check("compositor 导出 overlayBrandTextOnScene", compositorSrc.includes("export async function overlayBrandTextOnScene"), "missing");
  check("compositor 导出 pasteLogoOnScene", compositorSrc.includes("export async function pasteLogoOnScene"), "missing");
  check("worker 接线 IP 场景参考图重生成（comfyGenerateReferenceAnchor）", workerSrc.includes("IP 场景参考图重生成") && workerSrc.includes("comfyGenerateReferenceAnchor"), "missing");
  check("worker 接线场景 LOGO 贴入", workerSrc.includes("pasteLogoOnScene({ background: final, logo: roseLogoData"), "missing");
  check("worker 接线品牌文字叠加", workerSrc.includes("overlayBrandTextOnScene({ background: final, text: brandText"), "missing");
  check("worker 接线 Logo 元素视觉兜底（logoDesignElements）", workerSrc.includes("extractLogoElementsFromImage") && workerSrc.includes("logoDesignElements"), "missing");
  const promptLike = "中文品牌名'百疗萃养生馆'，可搭配一个简洁的抽象符号（如叶片或水滴），但以文字为核心。";
  const junkExtract = extractLogoElements(promptLike);
  check(
    "提示词式长句提取不到干净元素（只剩「但以文字为核心」垃圾 → 触发视觉兜底）",
    junkExtract.length === 0 || (junkExtract.length === 1 && junkExtract[0] === "但以文字为核心"),
    junkExtract.join(","),
  );

  // 4) P1/P2 接线
  check("render-pptx slogan 展示", renderSrc.includes("slogan?: string") && renderSrc.includes("品牌口号"), "missing");
  check("render-pptx DPI 数值表", renderSrc.includes("导出分辨率标准") && renderSrc.includes("300 dpi"), "missing");
  check("render-pptx LOGO 元素释义", renderSrc.includes("LOGO 元素释义") && renderSrc.includes("interpretLogoElements"), "missing");
  check("render-pptx IP 数字应用口径", renderSrc.includes("IP 版统一口径"), "missing");
  check("render-pptx 行业物料查表", renderSrc.includes("getIndustrySceneMaterials"), "missing");

  // 5) 无写死品牌名/公仔名
  const forbidden = ["百疗萃养生馆", "萃瑶"];
  check("行业规则文件无写死", forbidden.every((v) => !rulesSrc.includes(v)), forbidden.filter((v) => rulesSrc.includes(v)).join(","));
  check("worker/compositor/render 无写死", forbidden.every((v) => !workerSrc.includes(v) && !compositorSrc.includes(v) && !renderSrc.includes(v)), forbidden.filter((v) => workerSrc.includes(v) || compositorSrc.includes(v) || renderSrc.includes(v)).join(","));

  console.log(`\nRESULT pass=${passCount} fail=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
