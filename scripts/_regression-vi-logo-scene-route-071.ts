/**
 * 工单 071：A 类 Logo 场景门头五槽重排与呈现策略路由。
 * 纯离线断言，不生成图片、不调用 API。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workerSrc = readFileSync(path.join(root, "scripts/worker.mjs"), "utf8");

type LogoPlacement = {
  strategy: "reference_anchor" | "composite";
  fallback: "composite" | null;
  fidelitySource: string;
  promptIsFidelitySource: boolean;
  executorStatus: string;
};
type SceneItem = { key: string; prompt: string; logoPlacement: LogoPlacement };

const checks: { name: string; pass: boolean; evidence: string }[] = [];
function check(name: string, pass: boolean, evidence: string) {
  checks.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}  | 证据: ${evidence}`);
}

const coreMatch = workerSrc.match(
  /\/\/ 工单 066：A 类 logo 场景渲染要素[\s\S]*?(?=\/\/ === 021 scene prompts helper ===)/,
);
if (!coreMatch) throw new Error("无法提取 A 类场景核心函数");
const coreFactory = new Function(
  "getIndustryDefaults",
  "mascotSceneFamily",
  "mascotScenePaletteWords",
  `${coreMatch[0]}; return { LOGO_SCENE_KEYS, LOGO_SCENE_MATERIALS, logoSceneFamily, logoPlacementForScene, buildScenePrompts, resolveSelectedLogoAsset };`,
);
const core = coreFactory(
  () => ({ sceneStyle: "clean studio lighting" }),
  (industry: string) => industry || "general",
  (_industry: string, colors: string) => colors ? `brand colors ${colors}` : "brand colors from project",
) as {
  LOGO_SCENE_KEYS: string[];
  LOGO_SCENE_MATERIALS: Record<string, Record<string, string>>;
  logoPlacementForScene: (key: string) => LogoPlacement;
  buildScenePrompts: (name: string, industry: string, raw: string, colors: { hex: string }[]) => SceneItem[];
  resolveSelectedLogoAsset: (profile: unknown) => { status: string; imageUrl: string | null; message?: string };
};

const helperMatch = workerSrc.match(
  /\/\/ === 021 scene prompts helper ===([\s\S]*?)\/\/ === 021 scene prompts helper end ===/,
);
if (!helperMatch) throw new Error("无法提取 DeepSeek 场景建议函数");
const suggestionFactory = new Function(
  "buildScenePrompts",
  `${helperMatch[1]}; return buildScenePromptsFromSuggestions;`,
);
const buildFromSuggestions = suggestionFactory(core.buildScenePrompts) as (
  suggestions: { en?: string; zh?: string }[],
  name: string,
  industry: string,
  raw: string,
  colors: { hex: string }[],
) => SceneItem[];

const general = core.buildScenePrompts("测试品牌", "general", "通用服务", [{ hex: "#123456" }]);
const storefronts = general.filter((item) => item.key === "marketing-storefront");
check(
  "071-1 通用 fallback 保持五槽且仅一个正式门头槽",
  general.length === 5 && new Set(general.map((item) => item.key)).size === 5 && storefronts.length === 1,
  `keys=${general.map((item) => item.key).join(",")}`,
);
check(
  "071-2 门头 prompt 实际引用 storefront 物料并含品牌/色板/渲染语义",
  storefronts[0].prompt.includes(core.LOGO_SCENE_MATERIALS.general.storefront) &&
    storefronts[0].prompt.includes("测试品牌") &&
    storefronts[0].prompt.includes("#123456") &&
    storefronts[0].prompt.includes("studio quality render") &&
    storefronts[0].prompt.includes("logo presented clearly"),
  storefronts[0].prompt.slice(0, 180),
);

const familyCases = [
  ["restaurant", "餐饮", "restaurant storefront"],
  ["beverage", "饮品", "beverage shop storefront"],
  ["beauty", "丽人", "beauty salon storefront"],
  ["general", "汽车美容洗车", "car wash and auto detailing storefront"],
] as const;
const familyResults = familyCases.map(([industry, raw]) =>
  core.buildScenePrompts("测试品牌", industry, raw, []).find((item) => item.key === "marketing-storefront")!,
);
check(
  "071-3 餐饮/饮品/丽人/洗车门头物料正确且洗车无餐饮物料",
  familyResults.every((item, i) => item.prompt.includes(familyCases[i][2])) &&
    !/meal box|paper bag|napkin/i.test(familyResults[3].prompt),
  familyResults.map((item) => item.prompt.match(/photography of a ([^,]+)/)?.[1]).join(" | "),
);

const suggestionsWithStorefront = [
  { en: "branded flat package" },
  { en: "customer storefront signboard", zh: "客户门头" },
  { en: "business card mockup" },
  { en: "gift box mockup" },
  { en: "campaign poster" },
];
const mapped = buildFromSuggestions(suggestionsWithStorefront, "测试品牌", "beverage", "饮品", []);
const noStorefront = buildFromSuggestions([{ en: "package" }, { en: "poster" }], "测试品牌", "beverage", "饮品", []);
check(
  "071-4 DeepSeek 门头建议语义映射；缺门头时补通用门头",
  mapped.find((item) => item.key === "marketing-storefront")?.prompt.includes("customer storefront signboard") === true &&
    noStorefront.find((item) => item.key === "marketing-storefront")?.prompt.includes("beverage shop storefront") === true,
  `mapped=${mapped.find((item) => item.key === "marketing-storefront")?.prompt.slice(0, 80)}`,
);
check(
  "071-5 建议路径仍保持五张应用图契约",
  mapped.length === 5 && noStorefront.length === 5 && core.LOGO_SCENE_KEYS.length === 5,
  `mapped=${mapped.length} fallback=${noStorefront.length}`,
);

const storefrontPlacement = core.logoPlacementForScene("marketing-storefront");
const posterPlacement = core.logoPlacementForScene("marketing-1");
const flatPlacements = ["stationery-1", "packaging-1", "packaging-2"].map(core.logoPlacementForScene);
const unknownPlacement = core.logoPlacementForScene("unknown-slot");
check(
  "071-6 门头/海报为 reference_anchor 且 composite 保真回退",
  [storefrontPlacement, posterPlacement].every((p) => p.strategy === "reference_anchor" && p.fallback === "composite"),
  `storefront=${storefrontPlacement.strategy}/${storefrontPlacement.fallback}`,
);
check(
  "071-7 名片/包装等平面位使用 composite",
  flatPlacements.every((p) => p.strategy === "composite"),
  flatPlacements.map((p) => p.strategy).join(","),
);
check(
  "071-8 未知槽位安全回退 composite，不以 prompt 自画保真",
  unknownPlacement.strategy === "composite" && unknownPlacement.promptIsFidelitySource === false,
  `strategy=${unknownPlacement.strategy} promptFidelity=${unknownPlacement.promptIsFidelitySource}`,
);
check(
  "071-9 策略进入 scene item 并送达生成调用前请求",
  general.every((item) => ["ready", "candidate_074"].includes(item.logoPlacement?.executorStatus)) &&
    workerSrc.includes("const sceneGenerationRequests = activeScenePrompts.map") &&
    workerSrc.includes("partitionLogoSceneRequests(sceneGenerationRequests)") &&
    workerSrc.includes("request.logoPlacement?.strategy !== 'composite'") &&
    workerSrc.includes("compositeLogoOnScene"),
  "scene item → sceneGenerationRequests → 执行器分流",
);

const forbidden = [
  String.fromCodePoint(30334, 30103, 33803),
  "P" + "OLP",
  "VI-" + "20260806",
  "samples-" + "059",
  "pilot-" + "069",
  "logo-" + "rosegold",
];
const thisTestSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
check(
  "071-10 生产代码与回归无客户名/项目 ID/临时 Logo 路径",
  forbidden.every((value) => !workerSrc.includes(value) && !thisTestSrc.includes(value)),
  "禁用客户特例扫描",
);
check(
  "071-11 照片门头替换固定命中正式门头槽",
  /function pickPhotoSceneKeys\([\s\S]*?textKey: 'marketing-storefront'[\s\S]*?colorKey: 'marketing-1'/.test(workerSrc) &&
    !workerSrc.includes("textKey = textKey || 'marketing-1'"),
  "photo textKey=marketing-storefront",
);

const missingLogo = core.resolveSelectedLogoAsset({ logoGenerationResults: [{ imageUrl: "https://invalid/first.png" }] });
const selectedLogo = core.resolveSelectedLogoAsset({ selectedLogo: { imageUrl: "https://selected/logo.png" } });
check(
  "071-12 无明确选定 Logo 不擅取数组第一张，返回可诊断状态",
  missingLogo.status === "missing_selected_logo" && missingLogo.imageUrl === null &&
    missingLogo.message?.includes("不会回退") === true &&
    selectedLogo.status === "selected" && selectedLogo.imageUrl === "https://selected/logo.png",
  `missing=${missingLogo.status} selected=${selectedLogo.status}`,
);
check(
  "071-13 路由状态按执行器能力细分，reference 候选等待 074 放行",
  flatPlacements.every((item) => item.executorStatus === "ready") &&
    [storefrontPlacement, posterPlacement].every((item) => item.executorStatus === "candidate_074") &&
    workerSrc.includes("pendingSceneRequests.forEach") &&
    workerSrc.includes("不进入普通文生图批次"),
  "composite=ready；reference_anchor=candidate_074",
);
check(
  "071-14 正式门头 key 可被现有 marketing 前缀消费",
  "marketing-storefront".startsWith("marketing") &&
    workerSrc.includes("'marketing-storefront': 'VI应用效果图4'") &&
    workerSrc.includes("'marketing-storefront': '门店品牌系统'"),
  "renderScene 按 key.startsWith(type) 消费",
);

const failed = checks.filter((item) => !item.pass);
console.log(`\n=== 断言: ${checks.length - failed.length} passed, ${failed.length} failed | 退出码: ${failed.length ? 1 : 0} ===`);
if (failed.length) failed.forEach((item) => console.log("FAILED:", item.name));
process.exit(failed.length ? 1 : 0);
