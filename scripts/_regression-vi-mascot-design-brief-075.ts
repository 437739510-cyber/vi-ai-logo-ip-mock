/** 工单 075：动态公仔设计简报纯离线回归；不启动服务、不联网、不生图。 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildMascotDesignBrief } from "../src/lib/vi-manual/mascot-design-brief";

const workerSrc = readFileSync(new URL("../scripts/worker.mjs", import.meta.url), "utf8");
const selectionSrc = readFileSync(new URL("../src/app/api/ai/save-mascot-preference/route.ts", import.meta.url), "utf8");
const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
const checks: Array<{ name: string; pass: boolean; evidence: string }> = [];

function check(name: string, pass: boolean, evidence: string): void {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} | 证据: ${evidence}`);
}

function promptsOf(input: Parameters<typeof buildMascotDesignBrief>[0]): string[] {
  return buildMascotDesignBrief(input).sampleDirections.map((item) => item.prompt);
}

const humanGoddess = buildMascotDesignBrief({
  companyName: "测试美业品牌",
  industry: "beauty",
  brandPersonality: ["神圣", "优雅"],
  brandProfile: {
    brandToneKeywords: ["柔和", "高贵"],
    visualStyleSuggestion: "soft premium 3D, elegant flowing forms",
    colorPalette: [{ name: "粉红玫瑰金", hex: "#B76E79" }, { name: "暖米白", hex: "#F5EBDD" }],
  },
  mascotTypePref: ["character"],
  mascotStylePref: ["pixar_3d"],
  mascotPersonalityPref: ["温柔", "高贵"],
  mascotUsageScenes: ["storefront", "packaging"],
  mascotColorHint: "粉红玫瑰金 #B76E79 与暖米白 #F5EBDD",
  mascotRefIdea: "真正人类女神，成熟优雅，不是鹿人、没有鹿角鹿耳或animal ears",
  mascotSceneCount: 6,
});
const humanPrompts = humanGoddess.sampleDirections.map((item) => item.prompt);
const humanForbidden = /deer|antlers?|animal ears?|hybrid|鹿角|鹿耳|兽耳|鹿人|动物神人/i;
check(
  "075-1 人类女神四方向使用明确人类成年女性身份与真实色系",
  humanGoddess.roleType === "character" && humanGoddess.sources.colors === "customer" &&
    humanPrompts.length === 4 && humanPrompts.every((prompt) => /adult human woman/.test(prompt) && /人类成年女性/.test(prompt) && /#B76E79/.test(prompt) && !humanForbidden.test(prompt)),
  JSON.stringify({ roleType: humanGoddess.roleType, ids: humanGoddess.sampleDirections.map((item) => item.id), colors: humanGoddess.colors, colorSource: humanGoddess.sources.colors }),
);

const animalFood = buildMascotDesignBrief({
  companyName: "测试餐饮品牌",
  industry: "restaurant",
  brandProfile: {
    brandToneKeywords: ["adult woman", "warm"],
    visualStyleSuggestion: "rose gold goddess robe",
    colorPalette: [{ name: "辣椒红", hex: "#D9342B" }, { name: "谷物黄", hex: "#F2B441" }],
  },
  mascotTypePref: ["animal"],
  mascotUsageScenes: ["packaging", "storefront"],
  mascotRefIdea: "一只亲和的小熊厨师角色",
});
const nonAnimalInheritance = /goddess|adult woman|robe|rose gold|pixar|女神|成年女性|长袍|玫瑰金/i;
check(
  "075-2 动物餐饮公仔不继承女神、女性长袍或玫瑰金骨架",
  animalFood.roleType === "animal" && animalFood.sources.visualStyle === "industry" && animalFood.sampleDirections.every((item) => !nonAnimalInheritance.test(item.prompt)) && animalFood.colors.some((item) => item.includes("#D9342B")),
  JSON.stringify({ identity: animalFood.identity, style: animalFood.visualStyle, styleSource: animalFood.sources.visualStyle, colors: animalFood.colors }),
);

const techObject = buildMascotDesignBrief({
  companyName: "测试科技品牌",
  industry: "software technology",
  mascotTypePref: ["object"],
  mascotStylePref: ["tech_sleek"],
  mascotPersonalityPref: ["专业", "稳重"],
  mascotUsageScenes: ["app_icon", "ads"],
  mascotColorHint: "深蓝 #173B6C 与冷银 #B8C4CE",
  mascotRefIdea: "精密智能终端设备",
});
check(
  "075-3 科技物体型体现 tech_sleek 与专业感且无 Pixar 女性骨架",
  techObject.roleType === "object" && /tech_sleek/.test(techObject.visualStyle) && techObject.sampleDirections.every((item) => /professional/i.test(item.prompt) && !/pixar|goddess|adult woman|female figure/i.test(item.prompt)),
  JSON.stringify({ identity: techObject.identity, style: techObject.visualStyle, personality: techObject.personality }),
);

const paletteOne = promptsOf({
  companyName: "Palette One",
  industry: "retail",
  mascotTypePref: ["object"],
  brandProfile: { colorPalette: [{ name: "海军蓝", hex: "#112233" }] },
});
const paletteTwo = promptsOf({
  companyName: "Palette Two",
  industry: "retail",
  mascotTypePref: ["object"],
  brandProfile: { colorPalette: [{ name: "珊瑚橙", hex: "#EE6644" }] },
});
check(
  "075-4 两个项目色板隔离且不串色",
  paletteOne.every((prompt) => prompt.includes("#112233") && !prompt.includes("#EE6644")) && paletteTwo.every((prompt) => prompt.includes("#EE6644") && !prompt.includes("#112233")),
  JSON.stringify({ one: "#112233 only", two: "#EE6644 only" }),
);

const emptyFallback = buildMascotDesignBrief({ companyName: "Fallback Brand", industry: "general" });
check(
  "075-5 空偏好使用中性行业回退且不包含当前客户专属词",
  emptyFallback.roleType === "neutral" && emptyFallback.sources.roleType === "fallback" && emptyFallback.sampleDirections.length === 4 &&
    emptyFallback.sampleDirections.every((item) => !/goddess|rose gold|deer|antler|鹿人|女神|玫瑰金/i.test(item.prompt)),
  JSON.stringify({ roleType: emptyFallback.roleType, style: emptyFallback.visualStyle, colors: emptyFallback.colors }),
);

const sharedBases = humanGoddess.sampleDirections.map((item) => item.prompt.split(" Direction variant:")[0]);
check(
  "075-6 四方向同源于一份简报并以姿态/构图/气质形成变体",
  new Set(sharedBases).size === 1 && new Set(humanGoddess.sampleDirections.map((item) => item.prompt)).size === 4 &&
    humanGoddess.sampleDirections.map((item) => item.id).join("") === "abcd",
  JSON.stringify(humanGoddess.sampleDirections.map((item) => ({ id: item.id, desc: item.desc }))),
);

const sampleStart = workerSrc.indexOf("async function processMascotSampleGeneration");
const sampleEnd = workerSrc.indexOf("// ========== Mascot Full Generation", sampleStart);
const sampleBlock = workerSrc.slice(sampleStart, sampleEnd);
const consumedFields = [
  "brandPersonality", "brandProfile", "mascotTypePref", "mascotStylePref", "mascotPersonalityPref",
  "mascotUsageScenes", "mascotColorHint", "mascotRefIdea", "mascotSceneCount",
];
check(
  "075-7 Worker 消费动态编译器且移除 053 a~f 客户专属块",
  workerSrc.includes("import { buildMascotDesignBrief }") && sampleBlock.includes("buildMascotDesignBrief({") && consumedFields.every((field) => sampleBlock.includes(field)) &&
    !workerSrc.includes("mascot053Base") && !sampleBlock.includes("id: 'e'") && !sampleBlock.includes("id: 'f'") && !/玫瑰金色长发|暖米白长袍|圣洁女神公仔/.test(sampleBlock),
  JSON.stringify({ compiler: true, consumedFields: consumedFields.length, oldBlock: workerSrc.includes("mascot053Base") }),
);

check(
  "075-8 方向数量、状态分母和选择接口统一为 a~d",
  sampleBlock.includes("const stylePrompts = mascotBrief.sampleDirections") &&
    (sampleBlock.match(/\$\{stylePrompts\.length\}/g) || []).length >= 2 && !sampleBlock.includes("${successCount}/4") &&
    selectionSrc.includes('["a", "b", "c", "d"].includes(selectedSampleId)') && !/selectedSampleId.*["']e["']/.test(selectionSrc),
  JSON.stringify({ dynamicDenominators: (sampleBlock.match(/\$\{stylePrompts\.length\}/g) || []).length, selection: "a/b/c/d" }),
);

check(
  "075-9 无客户名、项目 ID 或测试色板写入生产实现",
  ["测试美业品牌", "测试餐饮品牌", "Palette One", "#112233", "#EE6644"].every((value) => !workerSrc.includes(value)) &&
    ["测试美业品牌", "测试餐饮品牌", "Palette One"].every((value) => !readFileSync(new URL("../src/lib/vi-manual/mascot-design-brief.ts", import.meta.url), "utf8").includes(value)) &&
    selfSrc.includes("测试美业品牌"),
  "fixtures remain regression-only",
);

const negativeLine = sampleBlock.match(/const negativePrompt = ([^;]+);/)?.[1] || "";
check(
  "075-10 样稿身份由正向简报自足，通用负向词不再压制动物/风格选择",
  /low quality/.test(negativeLine) && !/animal ears|antlers|deer|pink gradient|chibi|Q-version/.test(negativeLine) &&
    humanPrompts.every((prompt) => /Identity: adult human woman/.test(prompt)),
  negativeLine,
);

check(
  "075-11 简报结构保留角色、风格、性格、颜色、场景、禁忌与场景数量来源",
  humanGoddess.requestedRoleTypes.join(",") === "character" && humanGoddess.identityRestrictions.length >= 3 && humanGoddess.visualStyle.length > 0 && humanGoddess.personality.length === 2 &&
    humanGoddess.colors.length > 0 && humanGoddess.usageScenes.join(",") === "storefront,packaging" && humanGoddess.sceneCount === 4 &&
    humanGoddess.referenceIntent.length > 0 && humanGoddess.sources.roleType === "customer",
  JSON.stringify({ restrictions: humanGoddess.identityRestrictions, scenes: humanGoddess.usageScenes, sceneCount: humanGoddess.sceneCount, sources: humanGoddess.sources }),
);

const failed = checks.filter((item) => !item.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
process.exit(failed.length ? 1 : 0);
