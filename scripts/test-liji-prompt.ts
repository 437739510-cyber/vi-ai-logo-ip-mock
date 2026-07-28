import { generateMascotPromptSet } from "../src/lib/ip/mascot-prompt-strategy";

// 完整填写的李记数据
const result = generateMascotPromptSet({
  mascotProfile: {
    mode: "create_new",
    confidence: 0.9,
    hasMascot: true,
    suggestedName: "小布",
    suggestedType: "character",
    suggestedRole: "老北京布鞋匠人",
    personality: ["亲和", "传统", "手工", "匠人", "温暖", "地道"],
    visualTraits: ["传统中式", "国潮", "手工质感"],
    colorDirection: ["深藏青", "香槟金", "米白"],
    storySummary: "北京胡同三代老店，始于1950年代，从选布、纳底到上帮坚持纯手工，一双布鞋纳2000针",
    usageScenarios: ["storefront", "packaging", "membership", "social_media", "merchandise", "interior_decor"],
    visualDetails: {
      species: "warm friendly human artisan",
      pose: "standing upright holding handmade cloth shoes",
      expression: "warm friendly smile",
      atmosphere: ["traditional", "warm", "craftsmanship", "beijing"],
      accessories: ["traditional hat", "cloth shoes", "thread"],
      poseType: "friendly_waving" as any,
      expressionType: "smile" as any,
      viewType: "front" as any,
    },
  } as any,
  brandProfile: {
    brandPositioning: "李记老北京布鞋",
    industry: "retail_ecommerce",
    visualDirection: "chinese_trendy",
    brandPersona: ["手作匠心", "传统经典", "亲民温馨", "复古怀旧"],
    industryCategory: "retail_ecommerce",
    brandArchetype: "Caregiver",
  } as any,
  industryProfile: {
    visualKeywords: ["传统手工", "京味文化", "国潮", "匠心品质", "老北京胡同"],
  } as any,
  brandColors: {
    primary: "#1A1A2E",
    accent: "#C9A96E",
  } as any,
  clientPreferences: {
    mascotTypePref: ["character"],
    mascotStylePref: ["chinese_trendy"],
    mascotPersonalityPref: ["亲和", "传统", "手工", "匠人", "温暖", "地道"],
    mascotUsageScenes: ["storefront", "packaging", "membership", "social_media", "merchandise", "interior_decor"],
    mascotColorHint: "深藏青 #1A1A2E 和 香槟金 #C9A96E",
    mascotRefIdea: "可爱亲和的老北京布鞋匠人，圆脸红腮，戴传统黑色瓜皮帽，穿深藏青色中式对襟袄，腰系香槟金纹样腰带，手持一双千层底布鞋或针线，笑容憨厚亲和，3D风格化渲染，Pixar级品质。不是动物",
    mascotSceneCount: 6,
  },
});

console.log("========================================");
console.log("李记老北京布鞋 — 完整数据 Prompt 测试");
console.log("========================================");
console.log("");

console.log("=== imagePrompt (送生图) ===");
console.log(result.imagePrompt);
console.log("");

console.log("=== negativePrompt ===");
console.log(result.negativePrompt);
console.log("");

// 检查物种
const ip = result.imagePrompt || "";
if (ip.includes("human artisan")) {
  console.log("✅ 物种正确: 人物匠人");
} else if (ip.includes("bear") || ip.includes("rabbit") || ip.includes("deer")) {
  console.log("❌ 仍是动物!");
} else {
  console.log("⚠️ 需人工检查");
}

// 检查颜色
if (ip.includes("navy blue") || ip.includes("champagne gold")) {
  console.log("✅ 颜色映射正确");
}

// 检查风格
if (ip.includes("Chinese aesthetic") || ip.includes("oriental")) {
  console.log("✅ 风格为国潮/东方");
}
