/**
 * Mascot Prompt Strategy — 3 种模式验证测试
 *
 * 测试 A：已有 IP（椰岛工坊）→ protect_existing
 * 测试 B：无 IP 连锁茶饮 → create_new
 * 测试 C：律师事务所 → not_needed
 *
 * 运行: npx ts-node --compiler-options '{"module":"commonjs"}' src/lib/__tests__/mascot-prompt-test.ts
 * 或: node -r ts-node/register src/lib/__tests__/mascot-prompt-test.ts
 */

import { recommendMascot, type MascotProfile } from "@/agents/mascot-designer";
import { generateMascotPromptSet, verifyMascotPromptSet } from "@/lib/mascot-prompt-strategy";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"=".repeat(60)}`);
}

// ======================================
// 辅助：生成简化版 brandProfile
// ======================================

function makeBrandProfile(overrides: any = {}) {
  return {
    brandType: "consumer",
    brandPersona: ["自然", "阳光", "健康"],
    industry: "餐饮/食品",
    industryCategory: "food_beverage",
    brandPositioning: "高品质天然椰制品品牌",
    brandArchetype: "explorer",
    brandVoice: ["warm", "energetic"],
    visualDirection: "natural_organic",
    brandStage: "unknown",
    hasLogo: true,
    hasMascot: false,
    logoCount: 1,
    mascotCount: 0,
    targetAudience: "年轻消费者",
    differentiators: ["天然原料", "北纬18度"],
    analysis: { brandVisionKeywords: [], coreValueKeywords: [], marketKeywords: [] },
    ...overrides,
  };
}

function makeIndustryProfile(overrides: any = {}) {
  return {
    category: "food_beverage",
    label: "餐饮/食品",
    designStyle: ["自然", "热带", "清新"],
    colorTendency: ["绿色系", "暖色系"],
    typographyStyle: ["圆润", "现代"],
    typicalModules: ["logo-specs", "packaging", "social-media"],
    recommendedPageRange: [12, 30] as [number, number],
    visualKeywords: ["tropical", "fresh", "natural", "organic", "sunny"],
    sampleBrands: ["椰岛工坊"],
    ...overrides,
  };
}

// ======================================
// 测试 A：已有 IP（椰岛工坊）
// ======================================

section("测试 A：已有 IP（椰岛工坊）→ protect_existing");

const mascotA = recommendMascot({
  brandType: "consumer",
  industryCategory: "food_beverage",
  brandPersona: ["自然", "阳光", "健康"],
  brandArchetype: "explorer",
  brandStage: "growth",
  hasMascot: true,
  mascotName: "椰小匠",
  mascotAssetsCount: 3,
  businessGoal: "franchise",
  businessStage: "chain",
});

assert(mascotA.mode === "protect_existing", "模式应为 protect_existing");
assert(mascotA.hasMascot === true, "hasMascot 应为 true");
assert(mascotA.existingMascotName === "椰小匠", "IP 名称应为椰小匠");
assert(mascotA.confidence === 1.0, "置信度应为 1.0");

const promptSetA = generateMascotPromptSet({
  mascotProfile: mascotA,
  brandProfile: makeBrandProfile({ hasMascot: true, mascotCount: 3 }),
  industryProfile: makeIndustryProfile(),
});

assert(promptSetA.mode === "protect_existing", "PromptSet 模式应为 protect_existing");
assert(promptSetA.imagePrompt === null, "imagePrompt 应为 null（禁止重绘）");
assert(promptSetA.negativePrompt.length > 0, "negativePrompt 不应为空");
assert(promptSetA.strategyPrompt.includes("椰小匠"), "策略说明应包含 IP 名称");
assert(promptSetA.restrictions.length > 0, "应包含保护规则");

const issuesA = verifyMascotPromptSet(promptSetA);
assert(issuesA.length === 0, `验证不应有 issues（实际: ${issuesA.join(", ")}`);

// ======================================
// 测试 B：连锁茶饮（无 IP，强推荐）
// ======================================

section("测试 B：连锁茶饮（无 IP，建议创建）→ create_new");

const mascotB = recommendMascot({
  brandType: "consumer",
  industryCategory: "food_beverage",
  brandPersona: ["自然", "阳光", "健康"],
  brandArchetype: "explorer",
  brandStage: "growth",
  hasMascot: false,
  businessGoal: "franchise",
  businessStage: "chain",
});

assert(mascotB.mode === "create_new", "模式应为 create_new（franchise + chain 应为 full 推荐）");
assert(mascotB.hasMascot === false, "hasMascot 应为 false");
assert(mascotB.confidence >= 0.55, `置信度应 >= 0.55（实际: ${mascotB.confidence}）`);
assert(mascotB.suggestedName !== undefined, "应提供建议 IP 名称");
assert(mascotB.recommendedModules!.length >= 3, "应推荐至少 3 个 IP 模块");

const promptSetB = generateMascotPromptSet({
  mascotProfile: mascotB,
  brandProfile: makeBrandProfile(),
  industryProfile: makeIndustryProfile(),
});

assert(promptSetB.mode === "create_new", "PromptSet 模式应为 create_new");
assert(promptSetB.imagePrompt !== null, "imagePrompt 不应为 null");
assert(promptSetB.imagePrompt!.length > 80, "imagePrompt 应包含完整品牌上下文（>80 字符）");
assert(promptSetB.imagePrompt!.includes("brand mascot"), "imagePrompt 应包含 mascot 关键词");
assert(promptSetB.negativePrompt.length > 0, "negativePrompt 不应为空");
assert(promptSetB.negativePrompt.includes("photorealistic"), "negativePrompt 应包含通用禁止项");

const issuesB = verifyMascotPromptSet(promptSetB);
assert(issuesB.length === 0, `验证不应有 issues（实际: ${issuesB.join(", ")}`);

// ======================================
// 测试 C：律师事务所（不建议 IP）
// ======================================

section("测试 C：律师事务所（不建议 IP）→ not_needed");

const mascotC = recommendMascot({
  brandType: "service",
  industryCategory: "finance_legal",
  brandPersona: ["专业", "可信", "稳重"],
  brandArchetype: "sage",
  brandStage: "mature",
  hasMascot: false,
  businessGoal: "branding",
  businessStage: "enterprise",
});

assert(mascotC.mode === "not_needed", `模式应为 not_needed（实际: ${mascotC.mode}）`);
assert(mascotC.hasMascot === false, "hasMascot 应为 false");
assert(mascotC.confidence < 0.4, `置信度应 < 0.4（实际: ${mascotC.confidence}）`);

const promptSetC = generateMascotPromptSet({
  mascotProfile: mascotC,
  brandProfile: makeBrandProfile({
    brandType: "service",
    industryCategory: "finance_legal",
    brandPersona: ["专业", "可信", "稳重"],
    brandArchetype: "sage",
    brandPositioning: "专业法律服务品牌",
    visualDirection: "professional_trust",
  }),
  industryProfile: makeIndustryProfile({ category: "finance_legal", label: "金融/法律" }),
});

assert(promptSetC.mode === "not_needed", "PromptSet 模式应为 not_needed");
assert(promptSetC.imagePrompt === null, "imagePrompt 应为 null");
assert(promptSetC.usageNotes.length === 0, "usageNotes 应为空");
assert(promptSetC.strategyPrompt.includes("不适合"), "策略说明应包含'不适合'");

// ======================================
// 统计
// ======================================

console.log(`\n${"=".repeat(60)}`);
console.log(`  结果: ${passed} 通过, ${failed} 失败`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n  三种模式全部通过 ✅\n");
}
