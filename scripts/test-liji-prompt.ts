import { generateMascotPromptSet } from "../src/lib/ip/mascot-prompt-strategy";

// 李记老北京布鞋 — 从Supabase EFFY项目真实数据
const mascotProfile = {
  mode: "create_new",
  confidence: 0.85,
  hasMascot: true,
  suggestedName: "小布",
  suggestedType: "character",
  suggestedRole: "brand ambassador",
  personality: ["亲和", "传统", "手工", "匠人", "温暖", "地道"],
  visualTraits: ["传统中式", "国潮", "手工质感"],
  colorDirection: ["深藏青", "香槟金", "米白"],
  storySummary: "老北京布鞋匠人，匠心手工，京味文化",
  usageScenarios: ["storefront", "packaging", "membership", "social_media", "merchandise", "interior_decor"],
  visualDetails: {
    species: "warm friendly human artisan",
    pose: "standing upright holding cloth shoes",
    expression: "warm friendly smile",
    atmosphere: ["traditional", "warm", "craftsmanship"],
    accessories: ["traditional hat", "cloth shoes"],
    poseType: "friendly_waving" as any,
    expressionType: "smile" as any,
    viewType: "front" as any,
  },
};

const brandProfile = {
  brandPositioning: "李记老北京布鞋",
  industry: "retail_ecommerce",
  visualDirection: "chinese_trendy",
  brandPersona: ["亲和", "传统", "手工", "舒适", "地道"],
  industryCategory: "retail_ecommerce",
  brandArchetype: "Caregiver",
};

const industryProfile = {
  visualKeywords: ["传统手工", "京味文化", "国潮", "匠心品质"],
};

// 跟route.ts一样的数据格式
const brandColors = {
  primary: "#1A1A2E",
  accent: "#C9A96E",
};

const clientPreferences = {
  mascotTypePref: ["character"],
  mascotStylePref: ["chinese_trendy"],
  mascotPersonalityPref: ["亲和", "传统", "手工", "匠人", "温暖", "地道"],
  mascotUsageScenes: ["storefront", "packaging", "membership", "social_media", "merchandise", "interior_decor"],
  mascotColorHint: "深藏青 #1A1A2E 和 香槟金 #C9A96E",
  mascotRefIdea: "可爱亲和的老北京布鞋匠人，圆脸红腮，戴传统瓜皮帽或头巾，穿深蓝/藏青色中式对襟袄，手持一双千层底布鞋或针线，脚踩布鞋，笑容憨厚，体现手工匠心和京味文化。不要现代卡通熊/猫等动物。",
  mascotSceneCount: 6,
};

console.log("=== 李记老北京布鞋 — 真实数据 Prompt 测试 ===");
console.log("");

const result = generateMascotPromptSet({
  mascotProfile: mascotProfile as any,
  brandProfile: brandProfile as any,
  industryProfile: industryProfile as any,
  brandColors: brandColors as any,
  clientPreferences: clientPreferences as any,
});

console.log("=== imagePrompt ===");
console.log(result.imagePrompt);
console.log("");

// 检查
const imgp = result.imagePrompt || "";
if (imgp.includes("human artisan") || imgp.includes("human")) {
  console.log("✅ PASS: 是人类匠人");
} else if (imgp.includes("bear") || imgp.includes("rabbit") || imgp.includes("deer") || imgp.includes("fox") || imgp.includes("owl")) {
  console.log("❌ FAIL: 仍是动物");
} else {
  console.log("⚠️ CHECK:", imgp.slice(0, 200));
}
