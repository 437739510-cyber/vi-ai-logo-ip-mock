/**
 * Mascot Prompt Strategy — 3 种模式验证测试（独立脚本）
 *
 * 直接在 node 中运行，不依赖 ts-node/tsx。
 * 内联了 mascot-designer 和 mascot-prompt-strategy 的核心逻辑。
 *
 * 运行: node __tests__/mascot-prompt-test.js
 */

const path = require("path");

// ======================================
// 内联 recommendMascot 核心逻辑
// ======================================

const INDUSTRY_MASCOT_MAP_JS = {
  food_beverage: { needsMascot: true, confidence: 0.9, preferredTypes: ["food", "animal", "character"], reason: "食品饮料品牌非常适合通过IP公仔增强品牌亲和力和产品记忆点" },
  hospitality_tourism: { needsMascot: true, confidence: 0.85, preferredTypes: ["animal", "character", "plant"], reason: "酒店/文旅品牌通过IP公仔传递目的地文化和品牌温度" },
  retail_ecommerce: { needsMascot: true, confidence: 0.8, preferredTypes: ["animal", "character", "object"], reason: "零售/电商品牌通过IP公仔提升社交媒体传播力和用户粘性" },
  culture_media: { needsMascot: true, confidence: 0.85, preferredTypes: ["character", "abstract", "animal"], reason: "文化/传媒品牌的IP公仔是内容创作的核心资产" },
  education_training: { needsMascot: true, confidence: 0.75, preferredTypes: ["animal", "character"], reason: "教育品牌通过IP公仔降低距离感，增强品牌亲密度" },
  healthcare_medical: { needsMascot: false, confidence: 0.6, preferredTypes: ["animal", "character"], reason: "医疗健康品牌IP需求较低，但儿童/健康食品方向可考虑" },
  technology_it: { needsMascot: false, confidence: 0.4, preferredTypes: ["abstract", "character"], reason: "科技品牌通常不需要IP公仔，但面向消费者或营销传播时可考虑轻量IP" },
  finance_legal: { needsMascot: false, confidence: 0.3, preferredTypes: ["abstract"], reason: "金融法律品牌通常不适合IP公仔，除非品牌年轻化战略需要" },
  manufacturing: { needsMascot: false, confidence: 0.3, preferredTypes: ["object", "abstract"], reason: "制造企业通常不需要IP公仔，B2B品牌以专业形象为主" },
  real_estate: { needsMascot: false, confidence: 0.4, preferredTypes: ["character", "animal"], reason: "房地产行业IP需求较低，商业地产/社区项目可考虑" },
};

const BRAND_TYPE_MASCOT_BOOST_JS = {
  consumer: 0.9, hospitality: 0.85, retail: 0.8, lifestyle: 0.75, cultural: 0.8,
  healthcare: 0.5, education: 0.7, technology: 0.3, service: 0.2, industrial: 0.15,
};

const BUSINESS_GOAL_MASCOT_BOOST_JS = {
  franchise: 0.9, marketing: 0.85, packaging: 0.7, branding: 0.4,
};

function recommendMascotJS(input) {
  const { hasMascot, industryCategory, brandPersona, brandType, businessGoal, businessStage, mascotName, mascotAssetsCount } = input;

  if (hasMascot) {
    const depth = (businessGoal === "franchise" || businessStage === "chain" || businessStage === "enterprise") ? "full" : "light";
    const mods = depth === "full"
      ? ["mascot-profile", "mascot-three-view", "mascot-colors", "mascot-expression", "mascot-usage"]
      : ["mascot-profile", "mascot-colors"];
    return {
      mode: "protect_existing", confidence: 1.0, hasMascot: true,
      existingMascotName: mascotName || "品牌IP", existingMascotCount: mascotAssetsCount || 1,
      personality: brandPersona.slice(0, 3), visualTraits: ["保持原始形象", "保护品牌资产"],
      colorDirection: ["品牌原色", "不做AI改色"],
      usageScenarios: ["Logo搭配", "产品包装", "社交媒体", "门店展示"],
      reason: `品牌已有IP公仔"${mascotName || "品牌IP"}"，应保护原始形象`,
      recommendedModules: mods,
    };
  }

  let needScore = 0;
  const reasons = [];
  const industryTendency = INDUSTRY_MASCOT_MAP_JS[industryCategory];

  if (industryTendency) {
    if (industryTendency.needsMascot) {
      needScore += industryTendency.confidence * 35;
      reasons.push(industryTendency.reason);
    } else {
      needScore += industryTendency.confidence * 15;
    }
  } else {
    needScore += 5;
  }

  const brandTypeBoost = BRAND_TYPE_MASCOT_BOOST_JS[brandType] || 0.3;
  needScore += brandTypeBoost * 25;

  if (businessGoal) {
    const goalBoost = BUSINESS_GOAL_MASCOT_BOOST_JS[businessGoal] || 0.4;
    needScore += goalBoost * 20;
  }

  const personaBoost = Math.min(brandPersona.filter(p => ["亲和", "年轻", "活泼", "陪伴", "社群", "温暖", "阳光", "自然", "健康", "创新"].includes(p)).length * 5, 15);
  needScore += personaBoost;

  // Tech override
  if (industryCategory === "technology_it" && !industryTendency?.needsMascot) {
    const techMatch = brandPersona.filter(p => ["亲和", "年轻", "活泼", "陪伴", "社群", "温暖", "创新"].includes(p)).length;
    needScore += Math.min(techMatch * 8 + (businessGoal === "marketing" ? 10 : 0), 20);
  }

  const confidence = Math.min(1, needScore / 100);

  if (hasMascot) {
    // unreachable
    return null;
  } else if (confidence >= 0.55) {
    const depth2 = (businessGoal === "franchise") ? "full" : (businessGoal === "packaging") ? "light" : "minimal";
    const modMap = {
      full: { essential: ["mascot-profile", "mascot-three-view", "mascot-colors", "mascot-expression", "mascot-usage"], recommended: ["mascot-scene"] },
      light: { essential: ["mascot-profile", "mascot-colors"], recommended: ["mascot-expression", "mascot-usage"] },
      minimal: { essential: ["mascot-profile", "mascot-visual-direction"], recommended: ["mascot-colors", "mascot-usage"] },
    };
    const d = modMap[depth2];
    return {
      mode: "create_new", confidence, hasMascot: false,
      suggestedName: "小椰", suggestedType: "food", suggestedRole: "品牌形象代言人",
      personality: brandPersona.slice(0, 3), visualTraits: ["圆润线条", "柔和色块", "品牌色为主"],
      colorDirection: ["品牌主色", "自然绿色系", "暖橙色系"],
      storySummary: `一个${brandPersona.slice(0, 3).join("、")}的品牌IP角色`,
      usageScenarios: ["Logo搭配", "社交媒体头像", "产品包装", "门店招牌"],
      reason: reasons.join("；"), recommendedModules: [...d.essential, ...d.recommended],
    };
  } else if (confidence >= 0.4) {
    return {
      mode: "optional_recommend", confidence, hasMascot: false,
      suggestedName: "小椰", suggestedType: "character",
      personality: brandPersona.slice(0, 3), visualTraits: ["简约现代"],
      colorDirection: ["品牌主色"], usageScenarios: ["Logo搭配", "社交媒体头像"],
      reason: "品牌有一定IP潜力，非必需。",
      recommendedModules: ["mascot-profile", "mascot-visual-direction", "mascot-colors"],
    };
  } else {
    return {
      mode: "not_needed", confidence, hasMascot: false,
      personality: brandPersona.slice(0, 3), visualTraits: [], colorDirection: [],
      usageScenarios: [], reason: `当前品牌类型（${brandType}）和行业（${industryCategory}）不太适合IP公仔`,
      recommendedModules: [],
    };
  }
}

// ======================================
// 内联 generateMascotPromptSet 核心逻辑
// ======================================

function generateMascotPromptSetJS(mascotProfile, brandProfile) {
  if (mascotProfile.mode === "not_needed") {
    return { mode: "not_needed", strategyPrompt: "当前品牌不适合创建IP公仔，无需生成IP相关提示词。", imagePrompt: null, negativePrompt: "", usageNotes: [], restrictions: ["无需生成IP"] };
  }

  let negativeParts = ["no photorealistic rendering", "no complex backgrounds", "no text or typography in the image", "no watermarks"];

  if (mascotProfile.mode === "protect_existing") {
    return {
      mode: "protect_existing",
      strategyPrompt: `品牌已有IP公仔"${mascotProfile.existingMascotName}"。当前策略：保护原始形象，不做任何AI重绘、改色、改材质。IP角色性格：${mascotProfile.personality.join("、")}。建议应用场景：${mascotProfile.usageScenarios.join("、")}。禁止：AI重绘IP形象、改变IP比例、改变IP表情、更换角色设定。`,
      imagePrompt: null,
      negativePrompt: [...negativeParts, "do not change existing mascot design", "do not alter mascot proportions"].join("; "),
      usageNotes: ["保持原始IP形象，不做任何AI修改", "IP比例、表情、颜色严格遵循原始设计", "应用延展时使用原图嵌入，非AI重新生成"],
      restrictions: ["禁止AI重绘品牌Logo", "禁止AI重绘现有IP形象", "禁止改变IP比例和颜色", "禁止更换IP角色设定", "禁止AI改表情"],
    };
  }

  if (mascotProfile.mode === "create_new" || mascotProfile.mode === "optional_recommend") {
    const imageParts = [];
    imageParts.push(`A brand mascot character named "${mascotProfile.suggestedName || "brand mascot"}"`);
    imageParts.push(`designed as a food-personified character for ${brandProfile.brandPositioning || brandProfile.industry}`);
    imageParts.push(`brand personality: ${mascotProfile.personality.join(", ")}`);
    imageParts.push(`visual style: ${mascotProfile.visualTraits.join(", ")}`);
    imageParts.push(`color scheme: ${mascotProfile.colorDirection.join(", ")}`);
    if (mascotProfile.storySummary) imageParts.push(`character concept: ${mascotProfile.storySummary}`);
    imageParts.push("full body character");
    imageParts.push("isolated on white background");
    imageParts.push("flat vector illustration style");
    const imagePrompt = imageParts.join(". ") + ".";

    negativeParts.push("no generic clipart style", "no flat vector icon style unless specified");

    return {
      mode: mascotProfile.mode,
      strategyPrompt: mascotProfile.mode === "create_new"
        ? `品牌《${brandProfile.brandPositioning || brandProfile.industry}》需要创建IP公仔。建议名称："${mascotProfile.suggestedName}"。性格特征：${mascotProfile.personality.join("、")}。视觉方向：${mascotProfile.visualTraits.join("、")}。适用场景：${mascotProfile.usageScenarios.join("、")}。`
        : `品牌可以考虑创建轻量IP。建议名称："${mascotProfile.suggestedName}"。建议先创建IP形象方向稿。`,
      imagePrompt: mascotProfile.mode === "create_new" ? imagePrompt : imagePrompt,
      negativePrompt: negativeParts.join("; "),
      usageNotes: mascotProfile.mode === "create_new"
        ? ["生成IP前请确认品牌方同意IP方向和类型", "建议先生成3个风格方向供品牌方选择", "确认方向后再扩展三视图、表情包"]
        : ["建议先与客户沟通是否需要IP公仔", "如客户有兴趣，先从IP方向稿开始"],
      restrictions: ["禁止AI重绘品牌Logo", "IP设计风格需与品牌视觉方向一致", "IP色彩需使用品牌色系", "避免与其他品牌IP高度相似"],
    };
  }

  return { mode: "not_needed", strategyPrompt: "", imagePrompt: null, negativePrompt: "", usageNotes: [], restrictions: [] };
}

// ======================================
// 测试辅助
// ======================================

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
}
function section(name) { console.log(`\n${"=".repeat(60)}\n  ${name}\n${"=".repeat(60)}`); }

// ======================================
// 测试 A：已有 IP（椰岛工坊）
// ======================================

section("测试 A：已有 IP（椰岛工坊）→ protect_existing");

const mascotA = recommendMascotJS({
  brandType: "consumer", industryCategory: "food_beverage",
  brandPersona: ["自然", "阳光", "健康"], brandArchetype: "explorer", brandStage: "growth",
  hasMascot: true, mascotName: "椰小匠", mascotAssetsCount: 3,
  businessGoal: "franchise", businessStage: "chain",
});

assert(mascotA.mode === "protect_existing", "模式应为 protect_existing");
assert(mascotA.hasMascot === true, "hasMascot 应为 true");
assert(mascotA.existingMascotName === "椰小匠", "IP 名称应为椰小匠");
assert(mascotA.confidence === 1.0, "置信度应为 1.0");
assert(mascotA.recommendedModules.includes("mascot-profile"), "应推荐 mascot-profile 模块");

const promptA = generateMascotPromptSetJS(mascotA, { brandPositioning: "高品质天然椰制品品牌", industry: "餐饮/食品" });
assert(promptA.mode === "protect_existing", "PromptSet 模式应为 protect_existing");
assert(promptA.imagePrompt === null, "imagePrompt 应为 null（禁止重绘）");
assert(promptA.negativePrompt.length > 30, "negativePrompt 不应为空");
assert(promptA.strategyPrompt.includes("椰小匠"), "策略说明应包含 IP 名称");
assert(promptA.restrictions.length >= 3, "应包含至少 3 条保护规则");

// ======================================
// 测试 B：连锁茶饮（无 IP，强推荐）
// ======================================

section("测试 B：连锁茶饮（无 IP，建议创建）→ create_new");

const mascotB = recommendMascotJS({
  brandType: "consumer", industryCategory: "food_beverage",
  brandPersona: ["自然", "阳光", "健康"], brandArchetype: "explorer", brandStage: "growth",
  hasMascot: false, businessGoal: "franchise", businessStage: "chain",
});

assert(mascotB.mode === "create_new", `模式应为 create_new（实际: ${mascotB.mode}）`);
assert(mascotB.hasMascot === false, "hasMascot 应为 false");
assert(mascotB.confidence >= 0.55, `置信度应 >= 0.55（实际: ${mascotB.confidence}）`);
assert(mascotB.suggestedName !== undefined, "应提供建议 IP 名称");
assert(mascotB.recommendedModules.length >= 3, "应推荐至少 3 个 IP 模块");

const promptB = generateMascotPromptSetJS(mascotB, { brandPositioning: "新式茶饮品牌", industry: "餐饮/食品" });
assert(promptB.mode === "create_new", "PromptSet 模式应为 create_new");
assert(promptB.imagePrompt !== null, "imagePrompt 不应为 null");
assert(promptB.imagePrompt.length > 100, "imagePrompt 应包含完整品牌上下文");
assert(promptB.imagePrompt.includes("brand mascot"), "imagePrompt 应包含 mascot 关键词");
assert(promptB.negativePrompt.includes("photorealistic"), "negativePrompt 应包含通用禁止项");

// ======================================
// 测试 C：律师事务所（不建议 IP）
// ======================================

section("测试 C：律师事务所（不建议 IP）→ not_needed");

const mascotC = recommendMascotJS({
  brandType: "service", industryCategory: "finance_legal",
  brandPersona: ["专业", "可信", "稳重"], brandArchetype: "sage", brandStage: "mature",
  hasMascot: false, businessGoal: "branding", businessStage: "enterprise",
});

assert(mascotC.mode === "not_needed", `模式应为 not_needed（实际: ${mascotC.mode}）`);
assert(mascotC.hasMascot === false, "hasMascot 应为 false");
assert(mascotC.confidence < 0.4, `置信度应 < 0.4（实际: ${mascotC.confidence}）`);

const promptC = generateMascotPromptSetJS(mascotC, { brandPositioning: "专业法律服务品牌", industry: "金融/法律" });
assert(promptC.mode === "not_needed", "PromptSet 模式应为 not_needed");
assert(promptC.imagePrompt === null, "imagePrompt 应为 null");
assert(promptC.usageNotes.length === 0, "usageNotes 应为空");
assert(promptC.strategyPrompt.includes("不适合"), "策略说明应包含'不适合'");

// ======================================
// 结果
// ======================================

console.log(`\n${"=".repeat(60)}`);
console.log(`  结果: ${passed} 通过, ${failed} 失败`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) process.exit(1);
else console.log("\n  三种模式全部通过 ✅\n");
