/** 工单 076：完整公仔资产计划纯离线回归；不启动服务、不联网、不生图。 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildMascotDesignBrief, buildMascotFullAssetPlan } from "../src/lib/vi-manual/mascot-design-brief";

const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const productionSrc = readFileSync(new URL("../src/lib/vi-manual/mascot-design-brief.ts", import.meta.url), "utf8");
const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
const checks: Array<{ name: string; pass: boolean; evidence: string }> = [];

function check(name: string, pass: boolean, evidence: string): void {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} | 证据: ${evidence}`);
}

function allPrompts(plan: ReturnType<typeof buildMascotFullAssetPlan>): string[] {
  return [...plan.views, ...plan.emotions, ...plan.scenes].map((item) => item.prompt);
}

const goddessBrief = buildMascotDesignBrief({
  companyName: "076测试女神品牌",
  industry: "beauty",
  brandPersonality: ["优雅", "可靠"],
  brandProfile: { colorPalette: [{ name: "粉红玫瑰金", hex: "#B76E79" }, { name: "暖米白", hex: "#F5EBDD" }] },
  mascotTypePref: ["character"],
  mascotStylePref: ["pixar_3d"],
  mascotPersonalityPref: ["温柔", "高贵"],
  mascotUsageScenes: ["门店迎宾", "会员互动"],
  mascotColorHint: "粉红玫瑰金 #B76E79 与暖米白 #F5EBDD",
  mascotRefIdea: "真正人类女神，没有鹿角、鹿耳或 hybrid 身份",
  mascotSceneCount: 6,
});
const goddessPlan = buildMascotFullAssetPlan({
  brief: goddessBrief,
  styleAnchor: "标准识别款 正面平衡站姿",
  characterSpec: "adult human woman with mature natural anatomy and an elegant confident presence",
});
const goddessPrompts = allPrompts(goddessPlan);
check(
  "076-1 人类女神全套同源、数量完整且无混种词",
  goddessPlan.views.length === 3 && goddessPlan.emotions.length === 8 && goddessPlan.scenes.length >= 4 &&
    goddessPrompts.every((prompt) => /adult human woman/.test(prompt) && /Pixar-inspired/.test(prompt) && /3D cartoon/.test(prompt) &&
      /#B76E79/.test(prompt) && !/deer|antlers?|animal ears?|hybrid|鹿角|鹿耳/i.test(prompt)),
  JSON.stringify({ counts: goddessPlan.counts, identitySource: goddessPlan.sources.identity, palette: goddessPlan.colorPalette }),
);

const animalBrief = buildMascotDesignBrief({
  companyName: "076测试餐饮动物品牌",
  industry: "restaurant",
  brandProfile: {
    visualStyleSuggestion: "rose gold goddess robe",
    colorPalette: [{ name: "辣椒红", hex: "#D9342B" }, { name: "谷物黄", hex: "#F2B441" }],
  },
  mascotTypePref: ["animal"],
  mascotUsageScenes: ["餐厅门店", "外卖包装"],
  mascotSceneCount: 5,
});
const animalPlan = buildMascotFullAssetPlan({
  brief: animalBrief,
  styleAnchor: "亲和动物款",
  characterSpec: "friendly bear chef, adult woman goddess in rose gold robe, 3D Pixar style",
});
const animalPrompts = allPrompts(animalPlan);
check(
  "076-2 动物餐饮不继承女性/Pixar/玫瑰金且使用餐饮物料",
  animalPrompts.every((prompt) => !/woman|goddess|robe|rose gold|pixar|女神|长袍|玫瑰金/i.test(prompt)) &&
    animalPlan.scenes.some((item) => /restaurant|meal|menu|餐厅|外卖/i.test(`${item.name} ${item.prompt}`)) &&
    animalPlan.colorPalette.some((item) => item.hex === "#D9342B"),
  JSON.stringify({ scenes: animalPlan.scenes.map((item) => item.name), palette: animalPlan.colorPalette }),
);

const techBrief = buildMascotDesignBrief({
  companyName: "076测试科技物体品牌",
  industry: "software technology",
  mascotTypePref: ["object"],
  mascotStylePref: ["tech_sleek"],
  mascotPersonalityPref: ["专业", "稳重"],
  mascotUsageScenes: ["数字展厅", "app icon"],
  mascotColorHint: "深蓝 #173B6C 与冷银 #B8C4CE",
  mascotSceneCount: 5,
});
const techPlan = buildMascotFullAssetPlan({ brief: techBrief, styleAnchor: "精密科技款" });
check(
  "076-3 科技物体保留 tech_sleek、客户数字场景并由行业补足",
  allPrompts(techPlan).every((prompt) => /tech_sleek/.test(prompt) && !/woman|female|goddess|robe/i.test(prompt)) &&
    techPlan.scenes.some((item) => item.name === "数字展厅" && item.source === "customer") &&
    techPlan.scenes.some((item) => item.source === "industry") && techPlan.counts.scenes === 4,
  JSON.stringify({ scenes: techPlan.sources.scenes, counts: techPlan.counts }),
);

function beautyPlan(companyName: string, hex: string) {
  const brief = buildMascotDesignBrief({
    companyName,
    industry: "beauty",
    mascotTypePref: ["object"],
    brandProfile: { colorPalette: [{ name: "项目色", hex }] },
    mascotUsageScenes: ["门店"],
    mascotSceneCount: 4,
  });
  return buildMascotFullAssetPlan({ brief });
}
const beautyOne = beautyPlan("076测试美业甲", "#112233");
const beautyTwo = beautyPlan("076测试美业乙", "#EE6644");
const beautyOverrideBrief = buildMascotDesignBrief({
  companyName: "076测试美业客户色优先",
  industry: "beauty",
  mascotTypePref: ["object"],
  brandProfile: { colorPalette: [{ name: "行业候选玫瑰金", hex: "#B76E79" }] },
  mascotColorHint: "客户确认深青 #145A64",
  mascotSceneCount: 4,
});
const beautyOverride = buildMascotFullAssetPlan({ brief: beautyOverrideBrief });
check(
  "076-4 美业真实色板隔离，客户明确色板优先且不自动覆盖玫瑰金",
  allPrompts(beautyOne).every((prompt) => prompt.includes("#112233") && !prompt.includes("#EE6644") && !/rose gold|玫瑰金/i.test(prompt)) &&
    allPrompts(beautyTwo).every((prompt) => prompt.includes("#EE6644") && !prompt.includes("#112233") && !/rose gold|玫瑰金/i.test(prompt)) &&
    beautyOne.colorPalette[0]?.hex === "#112233" && beautyTwo.colorPalette[0]?.hex === "#EE6644" &&
    beautyOverride.sources.colors === "customer" && beautyOverride.colorPalette[0]?.hex === "#145A64" &&
    allPrompts(beautyOverride).every((prompt) => prompt.includes("#145A64") && !prompt.includes("#B76E79")),
  JSON.stringify({ one: beautyOne.colorPalette, two: beautyTwo.colorPalette, customerOverride: beautyOverride.colorPalette }),
);

const fallbackPlan = buildMascotFullAssetPlan({ brief: techBrief, styleAnchor: "" });
check(
  "076-5 无视觉提取时回退简报身份、风格、颜色并保留禁忌审计",
  fallbackPlan.sources.identity === "brief" && fallbackPlan.sources.styleAnchor === "brief" &&
    allPrompts(fallbackPlan).every((prompt) => prompt.includes(techBrief.identity) && prompt.includes(techBrief.visualStyle) && prompt.includes("#173B6C")) &&
    fallbackPlan.sources.identityRestrictions.join("|") === techBrief.identityRestrictions.join("|"),
  JSON.stringify({ sources: fallbackPlan.sources, identity: techBrief.identity }),
);

const fullStart = workerSrc.indexOf("async function processMascotFullGeneration");
const fullEnd = workerSrc.indexOf("// ========== Main Polling Loop", fullStart);
const fullBlock = workerSrc.slice(fullStart, fullEnd);
check(
  "076-6 Worker 三类生成项、核色色板和动态计数来自资产计划",
  workerSrc.includes("buildMascotFullAssetPlan") && fullBlock.includes("const assetPlan = buildMascotFullAssetPlan") &&
    fullBlock.includes("const { views, emotions, scenes } = assetPlan") && fullBlock.includes("assetPlan.colorPalette") &&
    fullBlock.includes("const totalImages = assetPlan.counts.total") &&
    (fullBlock.match(/assetPlan\.counts\.views/g) || []).length >= 2 &&
    !/3D Pixar style brand mascot|slender mature female|MASCOT_SCENE_RENDER|buildMascotScenePrompts/.test(fullBlock),
  JSON.stringify({ dynamicProgressWrites: (fullBlock.match(/assetPlan\.counts\.views/g) || []).length }),
);

const fixtures = ["076测试女神品牌", "076测试餐饮动物品牌", "076测试科技物体品牌", "076测试美业甲", "076测试美业客户色优先", "#112233", "#EE6644", "#145A64"];
check(
  "076-7 测试客户名和色板不进入生产实现",
  fixtures.every((value) => selfSrc.includes(value) && !productionSrc.includes(value) && !workerSrc.includes(value)),
  "fixtures remain regression-only",
);

check(
  "076-8 场景数量遵循请求且不足四项时安全补足",
  beautyOne.counts.scenes === 4 && beautyOne.sources.scenes[0]?.source === "customer" &&
    beautyOne.sources.scenes.slice(1).every((item) => item.source === "industry") &&
    goddessPlan.counts.total === goddessPlan.views.length + goddessPlan.emotions.length + goddessPlan.scenes.length,
  JSON.stringify({ beauty: beautyOne.sources.scenes, goddessCounts: goddessPlan.counts }),
);

const failed = checks.filter((item) => !item.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
process.exit(failed.length ? 1 : 0);
