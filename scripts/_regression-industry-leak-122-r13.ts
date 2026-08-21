/**
 * TICKET-122-R13 行业泄漏回归（离线，不联网、不生成、不产生增量文件）：
 *  1. 逐行业族（car/beauty/restaurant/beverage/general）经 worker 生产函数生成
 *     全部场景提示词，跑关键词 allow/deny 矩阵（无跨行业串味）；
 *  2. A2：buildImagePromptBySegments brandCtx 不再含鞋业/手工固定串，
 *     改由 profile 行业/性格/视觉特征驱动；
 *  3. B1：generateMascotPromptSet 匠人强化按客人偏好优先（Q版动物→不强加；
 *     匠人偏好→应用），源码含偏好辅助函数。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  buildImagePromptBySegments,
  MascotProfileV2,
  ViewType,
  ExpressionType,
  PoseType,
  StyleTier,
  IndustryCategory,
  BrandArchetype,
} from "../src/lib/ip/mascot-optimization";
import { generateMascotPromptSet } from "../src/lib/ip/mascot-prompt-strategy";

const ROOT = path.resolve(process.cwd());
const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
const ok = (name: string, cond: boolean, detail = "") => {
  checks.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
};

function evalWorkerScenePrompts() {
  const src = readFileSync(path.join(ROOT, "scripts/worker.mjs"), "utf8");
  const core = src.match(/\/\/ 工单 066：A 类 logo 场景渲染要素[\s\S]*?(?=\/\/ === 021 scene prompts helper ===)/);
  if (!core) throw new Error("worker core block missing");
  const factory = new Function(
    "getIndustryDefaults",
    "mascotSceneFamily",
    "mascotScenePaletteWords",
    `${core[0]}; return { buildScenePrompts };`,
  );
  const { buildScenePrompts } = factory(
    () => ({ sceneStyle: "clean studio lighting" }),
    (industry: string) => industry || "general",
    (_industry: string, colors: string) => (colors ? `brand colors ${colors}` : "brand colors from project"),
  ) as { buildScenePrompts: (name: string, industry: string, raw: string, colors: { hex: string }[]) => Array<{ key: string; prompt: string }> };
  return buildScenePrompts;
}

const INDUSTRIES: Array<{ type: string; raw: string; allow: string[]; deny: string[] }> = [
  { type: "car", raw: "洗车", allow: ["car wash", "auto", "洗车"], deny: ["美甲", "色卡", "nail salon", "beauty salon", "奶茶", "餐盒", "玫瑰金", "rose-gold"] },
  { type: "beauty", raw: "美甲", allow: ["beauty", "美容", "美甲"], deny: ["car wash", "洗车", "餐盒", "奶茶", "汽车"] },
  { type: "restaurant", raw: "餐厅", allow: ["restaurant", "餐"], deny: ["car wash", "洗车", "美甲", "nail salon"] },
  { type: "beverage", raw: "茶饮", allow: ["beverage", "饮品", "杯"], deny: ["car wash", "洗车", "美甲", "餐盒"] },
  { type: "general", raw: "通用", allow: ["brand"], deny: ["car wash", "洗车", "美甲", "nail salon", "餐盒"] },
];

function sceneMatrixTest() {
  const build = evalWorkerScenePrompts();
  for (const ind of INDUSTRIES) {
    const prompts = build("测试品牌", ind.type, ind.raw, [{ hex: "#0F6B6D" }, { hex: "#5CC8C4" }]);
    ok(`场景矩阵 ${ind.type}: 生成 5 场景`, prompts.length === 5 && new Set(prompts.map((p) => p.key)).size === 5, `keys=${prompts.map((p) => p.key).join(",")}`);
    const joined = prompts.map((p) => p.prompt).join("\n");
    const denied = ind.deny.filter((w) => joined.includes(w));
    ok(`场景矩阵 ${ind.type}: 无跨行业词`, denied.length === 0, `denied=${denied.join(",") || "none"}`);
    const allowed = ind.allow.filter((w) => joined.includes(w));
    ok(`场景矩阵 ${ind.type}: 含本行业词`, allowed.length >= 1, `allow=${allowed.join(",") || "none"}`);
  }
}

function mascotProfile(industry: string, personality: string[], visualTraits: string[]): MascotProfileV2 {
  return {
    mode: "create_new",
    confidence: 1,
    hasMascot: false,
    suggestedName: "小测",
    suggestedType: "character",
    suggestedRole: "品牌IP",
    personality,
    visualTraits,
    colorDirection: ["深青绿", "清水蓝绿"],
    storySummary: "测试角色",
    usageScenarios: ["门店", "包装"],
    visualDetails: {
      species: "humanoid character",
      pose: "standing upright",
      expression: "warm gentle smile",
      atmosphere: ["friendly"],
      accessories: [],
      poseType: PoseType.ELEGANT_POISED,
      expressionType: ExpressionType.SMILE,
      viewType: ViewType.FRONT,
    },
    styleTier: StyleTier.PIXAR_CARTOON,
    themeTags: [],
    coreAnchors: {
      species: "humanoid character",
      bodyColorDesc: "深青绿与清水蓝绿配色",
      keyAccessories: [],
      coreTexture: "smooth matte 3D Pixar texture",
    },
    industry: (industry as IndustryCategory) || IndustryCategory.RETAIL,
    archetype: BrandArchetype.CREATOR,
  };
}

function a2BrandCtxTest() {
  const cases = [
    { label: "美业", industry: "美业", personality: ["优雅", "亲切"], traits: ["soft", "elegant"], expect: ["美业", "优雅"] },
    { label: "汽车", industry: "汽车清洁养护", personality: ["踏实", "可靠"], traits: ["clean", "professional"], expect: ["汽车清洁养护", "踏实"] },
    { label: "餐饮", industry: "餐饮", personality: ["热情", "亲切"], traits: ["warm", "friendly"], expect: ["餐饮", "热情"] },
  ];
  for (const c of cases) {
    const prompt = buildImagePromptBySegments(mascotProfile(c.industry, c.personality, c.traits), ViewType.FRONT, ExpressionType.SMILE, "", "测试品牌");
    const leaked = /鞋业|手工|亲民传统匠心|handmade craft|布鞋/.test(prompt);
    const driven = c.expect.every((w) => prompt.includes(w));
    ok(`A2 brandCtx ${c.label}: 无鞋业/手工泄漏且由 profile 驱动`, !leaked && driven, `leaked=${leaked} driven=${driven}`);
  }
}

function b1PreferenceTest() {
  const strategySrc = readFileSync(path.join(ROOT, "src/lib/ip/mascot-prompt-strategy.ts"), "utf8");
  ok("B1 源码：含偏好辅助与 shouldForceArtisan 门控", strategySrc.includes("customerPrefersArtisan") && strategySrc.includes("customerPrefersAnimalCute") && strategySrc.includes("shouldForceArtisan") && strategySrc.includes("shouldForceArtisan(brandProfile, input.clientPreferences)"), "source wiring");

  const baseProfile = mascotProfile("老北京布鞋手工", ["憨厚", "亲切"], ["3D Pixar style", "cute", "friendly"]);
  const brandProfile: any = { industry: "老北京布鞋", industryCategory: "手工布鞋" };
  const craftProfile: any = { ...baseProfile };
  const run = (refIdea: string) => {
    try {
      return generateMascotPromptSet({
        mascotProfile: craftProfile,
        brandProfile,
        brandColors: { primary: "#1A1A2E", accent: "#C9A96E" },
        clientPreferences: { mascotRefIdea: refIdea },
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };
  const qv = run("Q版可爱小熊，软萌风格");
  const artisan = run("匠人手工布鞋，老北京风格");
  if ("error" in qv || "error" in artisan) {
    ok("B1 偏好分支：生成成功", false, `error=${("error" in qv ? qv.error : "") || ("error" in artisan ? artisan.error : "")}`);
    return;
  }
  const qvPrompt = qv.imagePrompt || "";
  const artisanPrompt = artisan.imagePrompt || "";
  ok("B1 Q版偏好：不强加老北京布鞋匠人", !/老北京布鞋匠人|cloth-shoe craftsman/.test(qvPrompt), `hasCraft=${/老北京布鞋匠人|cloth-shoe craftsman/.test(qvPrompt)}`);
  ok("B1 匠人偏好：应用匠人强化", /匠人|craftsman|artisan/.test(artisanPrompt), `hasCraft=${/匠人|craftsman|artisan/.test(artisanPrompt)}`);
}

async function main() {
  sceneMatrixTest();
  a2BrandCtxTest();
  b1PreferenceTest();
  const passCount = checks.filter((c) => c.pass).length;
  console.log(`RESULT ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
