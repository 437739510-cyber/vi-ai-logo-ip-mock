import { generateMascotPromptSet, verifyMascotPromptSet } from "../src/lib/ip/mascot-prompt-strategy.js";

// Mock data simulating a food_beverage brand
const mascotProfile = {
  mode: "create_new",
  suggestedName: "\u5C0F\u6930",
  suggestedType: "animal",
  personality: ["\u4EB2\u6C11", "\u6E29\u6696"],
  visualTraits: ["\u7B80\u7EA6\u73B0\u4EE3"],
  colorDirection: ["warm green"],
  usageScenarios: ["\u793E\u4EA4\u5A92\u4F53", "\u5305\u88C5", "\u5E97\u9762"],
  suggestedRole: "brand ambassador",
  storySummary: "A warm coconut character representing natural sweetness",
};

const brandProfile = {
  brandPositioning: "food_beverage",
  industry: "food_beverage",
  visualDirection: "warm_friendly",
  brandPersona: ["friendly"],
};

const industryProfile = {
  visualKeywords: ["cute food", "appetizing", "natural ingredients", "warm", "organic"],
};

const brandColors = {
  primary: { hex: "#8BC34A", name: "warm green" },
  accent: { hex: "#FFB74D", name: "orange" },
  secondary: { hex: "#FFF3E0", name: "cream" },
};

const clientPreferences = {
  mascotTypePref: ["animal mascot"],
  mascotStylePref: ["cute", "friendly"],
  mascotPersonalityPref: ["warm", "gentle"],
  mascotUsageScenes: ["social media", "packaging"],
  mascotColorHint: "\u70ED\u5E26\u98CE\u683C\u6696\u8272",
};

const result = generateMascotPromptSet({
  mascotProfile: mascotProfile,
  brandProfile: brandProfile,
  industryProfile: industryProfile,
  brandColors: brandColors,
  clientPreferences: clientPreferences,
});

console.log("========================================");
console.log("=== NEW Prompt (after upgrade) ===");
console.log("========================================");
console.log("");
console.log("imagePrompt:");
console.log(result.imagePrompt);
console.log("");
console.log("negativePrompt:");
console.log(result.negativePrompt);
console.log("");
console.log("=== Verification ===");
const issues = verifyMascotPromptSet(result);
if (issues.length === 0) {
  console.log("PASS: All verification checks passed");
} else {
  console.log("FAIL: Issues found:");
  issues.forEach(i => console.log("  - " + i));
}
console.log("");
console.log("=== Mode checks ===");
console.log("Mode: " + result.mode);
console.log("imagePrompt is null? " + (result.imagePrompt === null));
console.log("Has strategyPrompt? " + (result.strategyPrompt ? "yes" : "no"));