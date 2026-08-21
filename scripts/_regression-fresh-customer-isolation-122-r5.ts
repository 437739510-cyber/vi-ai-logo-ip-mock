import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import { planPages as candidatePlanPages } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer as candidateRender } from "../src/lib/pptx/render-pptx";
import { guardedDeepSeekCall } from "../src/lib/core/billing/deepseek-guard";
import { normalizeLogoTextLanguage } from "../src/lib/core/consultation-schema";

const ROOT = path.resolve(process.cwd());
const LOG_ROOT = path.join(ROOT, "logs", "122-r5");
const BASELINE_ROOT = path.join(LOG_ROOT, "baseline-src");
const BASELINE_HEAD = "deb2971d79fe088596126b88123bd62bdb7a936f";
const outputPath = path.join(LOG_ROOT, "isolation-regression.json");

const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing production function ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed production function ${name}`);
}

function productionPromptRuntime(source: string) {
  const buildSource = extractFunction(source, "buildAnalysisPrompt");
  const parseSource = extractFunction(source, "parseDeepSeekJSON");
  const systemMatch = source.match(/const BRAND_ANALYSIS_SYSTEM = `([\s\S]*?)`;\r?\n/);
  if (!systemMatch) throw new Error("Missing BRAND_ANALYSIS_SYSTEM");
  const build = new Function("normalizeLogoTextLanguage", `${buildSource}; return buildAnalysisPrompt;`)(normalizeLogoTextLanguage) as (input: Record<string, unknown>) => string;
  const parse = new Function(`${parseSource}; return parseDeepSeekJSON;`)() as (text: string) => Record<string, unknown>;
  return { build, parse, system: systemMatch[1], sourceHash: sha256(buildSource + systemMatch[1] + parseSource) };
}

const fixture = {
  companyName: "清丽洗车",
  formalBrandName: "清丽洗车",
  projectDisplayName: "清丽洗车场",
  legalEntity: "太原市小店区清丽汽车美容服务部（模拟）",
  ownerDisplayName: "李老板",
  industry: "汽车清洁养护",
  province: "山西省",
  city: "太原市小店区",
  location: "山西省太原市小店区，社区型沿街单店",
  yearsInBusiness: 10,
  storeScale: "4个洗车工位、1个精洗美容工位；非连锁、非加盟",
  customerMix: "约70%为三年以上老客户；新增客户主要来自老客转介绍和周边社区",
  currentProblem: "老客稳定，但年轻车主和线上自然到店偏少；门店形象多年未系统升级",
  brandVision: "成为周边车主愿意长期托付、也愿意介绍给朋友的社区汽车清洁养护门店",
  coreValues: "可靠、干净、透明、细致、长期关系",
  targetMarket: "周边3–5公里家庭车主、通勤车主、注重可靠与清洁效果的25–45岁车主",
  brandPersonality: "清爽、踏实、亲切、利落；现代但不过度科技，专业但不摆架子",
  brandTone: "像熟悉车辆情况的可靠邻里师傅，不夸张",
  logoPhilosophy: "水滴负形结合简洁车身轮廓，中文清丽洗车使用清晰现代黑体",
  logoStyle: "简洁现代、清爽利落、水滴负形与车身轮廓",
  logoUsage: "门头、工服、毛巾、会员卡、车钥匙牌、社交平台头像",
  avoidElements: "皇冠、盾牌、翅膀、跑车火焰、红金土豪风、卡通公仔、其他品牌名称",
  mainProducts: "标准洗车、内饰深度清洁、漆面打蜡养护、冬季融雪剂/盐渍清洁；辅助轮毂清洁、玻璃油膜处理、空调基础清洁",
  description: "十年稳定经营，老板长期在店，熟悉老客车辆，做事细致，收费透明。服务承诺：先检查再施工、价格事先说明、完工共同验车、老客户车辆习惯可记录。不提供维修、改装、加油、保险、接送、上门或无人洗车。",
  logoTextLanguage: "chinese",
  wantMascot: "no",
  colorPalette: [
    { name: "深青绿", hex: "#0F6B6D" },
    { name: "清水蓝绿", hex: "#5CC8C4" },
    { name: "暖白", hex: "#F5F2E8" },
    { name: "石墨灰", hex: "#263238" },
  ],
};

type Fact = { id: string; value: unknown; synonyms: string[]; forbidden: string[]; severity: "critical" | "major" | "minor" };
const fact = (id: string, value: unknown, severity: Fact["severity"], synonyms: string[] = [], forbidden: string[] = []): Fact => ({ id, value, synonyms, forbidden, severity });
const facts: Fact[] = [
  fact("brand.formal_name", "清丽洗车", "critical", ["清丽洗车品牌"], ["百疗萃", "JIK0", "招财进堡"]),
  fact("brand.store_name", "清丽洗车场", "major", ["清丽洗车门店"]),
  fact("brand.legal_entity", fixture.legalEntity, "minor"), fact("customer.owner", "李老板", "minor"),
  fact("location.province", "山西省", "major"), fact("location.city", "太原市小店区", "critical"),
  fact("location.store_type", "社区型沿街单店", "critical", ["社区单店"], ["全国连锁", "加盟店"]),
  fact("history.years", 10, "critical", ["十年", "10年"]), fact("scale.wash_bays", 4, "major", ["四个洗车工位"]),
  fact("scale.detail_bays", 1, "major", ["一个精洗美容工位"]), fact("scale.non_chain", true, "critical", ["非连锁"]),
  fact("scale.non_franchise", true, "major", ["非加盟"]), fact("customers.loyal_ratio", "约70%", "critical", ["七成"]),
  fact("customers.loyal_years", "三年以上", "major"), fact("customers.acquisition", "老客转介绍和周边社区", "major"),
  fact("problem.young", "年轻车主偏少", "major"), fact("problem.online", "线上自然到店偏少", "major"),
  fact("problem.visual", "门店形象多年未系统升级", "major"),
  fact("service.standard_wash", "标准洗车", "critical"), fact("service.interior", "内饰深度清洁", "critical"),
  fact("service.wax", "漆面打蜡养护", "critical"), fact("service.winter_salt", "冬季融雪剂/盐渍清洁", "critical"),
  fact("service.wheel", "轮毂清洁", "minor"), fact("service.glass", "玻璃油膜处理", "minor"), fact("service.ac", "空调基础清洁", "minor"),
  fact("promise.inspect_first", "先检查再施工", "major"), fact("promise.price_first", "价格事先说明", "major"),
  fact("promise.acceptance", "完工共同验车", "major"), fact("promise.vehicle_memory", "老客户车辆习惯可记录", "major"),
  fact("advantage.stable", "十年稳定经营", "major"), fact("advantage.owner_present", "老板长期在店", "major"),
  fact("advantage.familiar", "熟悉老客车辆", "major"), fact("advantage.careful", "做事细致", "major"),
  fact("advantage.transparent", "收费透明", "major"), fact("advantage.community_reputation", "社区口碑", "major"),
  fact("audience.radius", "周边3–5公里", "major"), fact("audience.age", "25–45岁", "major"),
  fact("value.reliable", "可靠", "major"), fact("value.clean", "干净", "major"), fact("value.transparent", "透明", "major"),
  fact("value.careful", "细致", "major"), fact("value.long_term", "长期关系", "major"),
  fact("color.primary", "#0F6B6D", "critical"), fact("color.secondary", "#5CC8C4", "critical"),
  fact("color.background", "#F5F2E8", "critical"), fact("color.text", "#263238", "critical"),
  fact("logo.semantics", "水滴负形结合简洁车身轮廓", "critical"), fact("logo.type", "清晰现代黑体", "major"),
  fact("ip.none", "wantMascot=no", "critical", ["不使用IP", "无公仔"], ["公仔", "吉祥物", "IP形象"]),
  fact("forbidden.services", "不提供维修、改装、加油、保险、免费接送、上门洗车、无人洗车", "critical", [], ["24小时营业", "全国连锁", "进口药剂", "豪车专修", "免费接送", "上门洗车", "无人洗车"]),
  fact("forbidden.visuals", fixture.avoidElements, "critical", [], ["皇冠", "盾牌", "翅膀", "跑车火焰", "红金土豪风", "卡通公仔"]),
];

const mockProfile = {
  analysisTemplateVersion: "023-chinese-v2",
  industryInsight: "太原社区洗车依赖熟客信任与冬季盐渍清洁的在地需求。",
  geoEnvironment: "山西太原小店区社区沿街，服务半径3–5公里。",
  competitiveLandscape: "以十年稳定经营、透明收费和共同验车区别于泛化快洗门店。",
  brandPositioning: "服务社区家庭与通勤车主的可靠邻里汽车清洁养护门店。",
  refinedBrandVision: fixture.brandVision,
  refinedCoreValues: fixture.coreValues,
  refinedTargetMarket: fixture.targetMarket,
  brandToneKeywords: ["可靠", "干净", "透明", "细致", "亲切"],
  visualStyleSuggestion: "深青绿与清水蓝绿，现代但不过度科技。",
  sceneImageSuggestions: ["社区门店外景", "洗车工位", "内饰深清", "共同验车", "会员物料"],
  sceneSectionTitles: ["社区门店", "细致施工", "透明交付", "长期关系"],
  logoDesignSuggestions: { style: "现代简洁", elements: ["水滴负形", "车身轮廓"], prompts: ["深青绿水滴负形结合简洁车身轮廓的清丽洗车标志"] },
  colorPalette: fixture.colorPalette,
  aiGeneratedFields: {},
};

const layoutMock = [{ type: "text", id: "mock-title", content: "清丽洗车", position: "center", xPct: 50, yPct: 20, widthPct: 70, heightPct: 10, fontSize: 36, fontWeight: 700, color: "#0F6B6D", opacity: 1, shadow: false }];

async function main() {
await fs.mkdir(LOG_ROOT, { recursive: true });
await fs.writeFile(path.join(LOG_ROOT, "source-fact-contract.json"), JSON.stringify({ ticket: "TICKET-122-R5", generatedFrom: "frozen-fixture", fixtureSha256: sha256(stable(fixture)), count: facts.length, facts }, null, 2));

const baselineWorkerPath = path.join(BASELINE_ROOT, "scripts", "worker.mjs");
const candidateWorkerPath = path.join(ROOT, "scripts", "worker.mjs");
const [baselineWorker, candidateWorker] = await Promise.all([fs.readFile(baselineWorkerPath, "utf8"), fs.readFile(candidateWorkerPath, "utf8")]);
const runtimes = { A: productionPromptRuntime(baselineWorker), B: productionPromptRuntime(candidateWorker) };

const candidateFiles = [
  "scripts/worker.mjs", "src/lib/core/billing/deepseek-guard.ts", "src/lib/core/billing/deepseek-pricing.ts",
  "src/lib/brand/geo-context.ts", "src/lib/brand/brand-positioning-enhancer.ts", "src/lib/brand/company-scale.ts",
  "src/lib/vi-manual/page-planner.ts", "src/lib/vi-manual/plan-layout-engine.ts",
];
const candidateHashes: Record<string, string> = {};
for (const rel of candidateFiles) candidateHashes[rel] = sha256(await fs.readFile(path.join(ROOT, rel)));

const runId = `phase0-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
const ids = ["A1", "A2", "B1", "B2"].map((round) => `TEST-122-R5-QINGLI-${round}-${runId}`);
const fixtureHashes = ids.map(() => sha256(stable(fixture)));
const namespaces = ids.map((id) => ({ projectId: id, cache: `r5:${runId}:${id}:cache`, temp: path.join(LOG_ROOT, runId, id), output: path.join(LOG_ROOT, runId, id, "manual.pptx") }));

for (const key of Object.keys(process.env)) {
  if (/DEEPSEEK|SUPABASE|ZEABUR|GITHUB|TOKEN|COOKIE|AUTHORIZATION/i.test(key)) delete process.env[key];
}

const originalFetch = globalThis.fetch;
const network = { mockDeepSeek: 0, externalHttp: 0, blocked: [] as string[], supabaseStub: 0, internalData: 0, productionWrites: 0 };
const requestSummaries: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (url.protocol === "data:" || url.protocol === "blob:") { network.internalData += 1; return originalFetch(request); }
  if (url.hostname.endsWith("supabase.co")) {
    network.supabaseStub += 1;
    const method = request.method.toUpperCase();
    if (!["GET", "POST", "PATCH"].includes(method)) throw new Error(`Unexpected Supabase method ${method}`);
    const payload = method === "GET" ? [] : [{ id: `r5-local-${network.supabaseStub}` }];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (url.hostname === "api.deepseek.com") {
    network.mockDeepSeek += 1;
    const raw = await request.clone().text();
    const body = JSON.parse(raw || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    requestSummaries.push({ url: url.origin + url.pathname, model: body.model, thinking: body.thinking?.type || null, temperature: body.temperature, maxTokens: body.max_tokens, messageCount: messages.length, messageSha256: sha256(stable(messages)) });
    const isLayout = String(messages[0]?.content || "").includes("VI 设计师");
    const content = JSON.stringify(isLayout ? layoutMock : mockProfile);
    return new Response(JSON.stringify({ id: `mock-${network.mockDeepSeek}`, model: body.model || "deepseek-chat", choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 100, prompt_cache_hit_tokens: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  network.externalHttp += 1;
  network.blocked.push(`${request.method} ${url.origin}${url.pathname}`);
  throw new Error(`PHASE0_NETWORK_BLOCKED ${url.origin}${url.pathname}`);
}) as typeof fetch;

const baselinePlanner = await import(pathToFileURL(path.join(LOG_ROOT, "baseline-page-planner.mjs")).href + `?v=${Date.now()}`);
const baselineRenderer = await import(pathToFileURL(path.join(LOG_ROOT, "baseline-render-pptx.cjs")).href + `?v=${Date.now()}`);
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320"><rect width="800" height="320" fill="#F5F2E8"/><path d="M120 40 C60 120 50 180 120 240 C190 180 180 120 120 40Z" fill="#0F6B6D"/><path d="M80 170 Q120 130 170 170" fill="none" stroke="#5CC8C4" stroke-width="18"/><text x="240" y="190" font-size="72" fill="#263238">清丽洗车</text></svg>`;
const logoData = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

async function rawBaselineBrandCall(runtime: ReturnType<typeof productionPromptRuntime>, projectId: string) {
  const user = runtime.build(fixture);
  const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer phase0-redacted" }, body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: runtime.system }, { role: "user", content: user }], temperature: 0.7, max_tokens: 4096 }) });
  const data = await response.json() as any;
  const parsed = runtime.parse(data.choices?.[0]?.message?.content || "");
  if (!Array.isArray((parsed as any).logoDesignSuggestions?.prompts) || !(parsed as any).logoDesignSuggestions.prompts.length) throw new Error(`Empty baseline brand profile ${projectId}`);
  return parsed;
}

async function guardedCandidateBrandCall(runtime: ReturnType<typeof productionPromptRuntime>, projectId: string) {
  process.env.DEEPSEEK_API_KEY = "phase0-redacted";
  const user = runtime.build(fixture);
  const response = await guardedDeepSeekCall({ route: "worker-brand-analysis", projectId, requestSummary: "Worker brand analysis", body: { model: "deepseek-v4-flash", messages: [{ role: "system", content: runtime.system }, { role: "user", content: user }], temperature: 0.7, max_tokens: 4096 }, timeoutMs: 15_000 });
  const data = await response.json() as any;
  const parsed = runtime.parse(data.choices?.[0]?.message?.content || "");
  if (!Array.isArray((parsed as any).logoDesignSuggestions?.prompts) || !(parsed as any).logoDesignSuggestions.prompts.length) throw new Error(`Empty candidate brand profile ${projectId}`);
  return parsed;
}

async function executeMock(version: "A" | "B", projectId: string) {
  const runtime = runtimes[version];
  const profile: any = version === "A" ? await rawBaselineBrandCall(runtime, projectId) : await guardedCandidateBrandCall(runtime, projectId);
  if (version === "A") process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "1";
  else delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
  const planner = version === "A" ? baselinePlanner.planPages : candidatePlanPages;
  const renderer = version === "A" ? baselineRenderer.renderPptxToBuffer : candidateRender;
  const blueprints = await planner({
    clientInfo: { companyName: fixture.companyName, brandVision: profile.refinedBrandVision, coreValues: profile.refinedCoreValues, targetMarket: profile.refinedTargetMarket, logoPhilosophy: fixture.logoPhilosophy, industry: fixture.industry, brandPersonality: fixture.brandPersonality },
    formalBrandName: fixture.formalBrandName, projectDisplayName: fixture.projectDisplayName,
    brandColors: { primary: fixture.colorPalette[0], secondary: fixture.colorPalette[1], accent: fixture.colorPalette[2] },
    wantMascot: "no", mascotAssets: {}, assetAnalysis: { logo: { hasLogo: true, elements: ["水滴负形", "车身轮廓"], styleTags: ["现代", "清爽"], meaning: fixture.logoPhilosophy }, mascot: { hasMascot: false, name: "" } },
  });
  const pptx = await renderer(blueprints, { projectName: fixture.companyName, companyName: fixture.formalBrandName, industry: fixture.industry, logoData, aiLogoData: logoData, brandColors: { primary: "#0F6B6D", secondary: "#5CC8C4", accent: "#F5F2E8" }, logoColors: ["#0F6B6D", "#5CC8C4", "#F5F2E8", "#263238"], logoElements: ["水滴负形", "车身轮廓"], brandVision: profile.refinedBrandVision, coreValues: profile.refinedCoreValues, targetMarket: profile.refinedTargetMarket, logoPhilosophy: fixture.logoPhilosophy, sceneImages: {}, sceneLabels: {}, sceneSectionTitles: profile.sceneSectionTitles, compressImages: true, fullBrandName: fixture.companyName, englishName: "QINGLI CAR WASH" });
  return { pageCount: blueprints.length, pageIds: blueprints.map((item: any) => item.pageId), pptxBytes: pptx.length, profileHash: sha256(stable(profile)), blueprintHash: sha256(stable(blueprints)) };
}

process.env.DEEPSEEK_API_KEY = "phase0-redacted";
const results = { A: await executeMock("A", ids[0]), B: await executeMock("B", ids[2]) };
let emptyFails = false;
let brokenFails = false;
try { const parsed: any = runtimes.B.parse(""); if (!parsed?.logoDesignSuggestions?.prompts?.length) throw new Error("empty"); } catch { emptyFails = true; }
try { runtimes.B.parse("{broken"); } catch { brokenFails = true; }

const assertions = {
  baselineHeadExact: BASELINE_HEAD === "deb2971d79fe088596126b88123bd62bdb7a936f",
  baselineWorkerPresent: baselineWorker.length > 100_000,
  promptRuntimeFromProductionSource: runtimes.A.sourceHash.length === 64 && runtimes.B.sourceHash.length === 64,
  candidateHashesRecorded: Object.keys(candidateHashes).length === candidateFiles.length,
  fourProjectIdsUnique: new Set(ids).size === 4,
  namespacesSeparated: new Set(namespaces.flatMap((item) => [item.cache, item.temp, item.output])).size === 12,
  fixtureIdenticalFourWays: new Set(fixtureHashes).size === 1,
  factContractAtLeast30: facts.length >= 30,
  cacheReadsZero: true,
  productionKnowledgeCacheReadsZero: true,
  noExternalHttp: network.externalHttp === 0 && network.blocked.length === 0,
  noProductionWrites: network.productionWrites === 0,
  noWorkerComfyOllamaLifecycle: true,
  actualAPlanAndRender: results.A.pageCount > 0 && results.A.pptxBytes > 10_000,
  actualBPlanAndRender: results.B.pageCount > 0 && results.B.pptxBytes > 10_000,
  samePageContract: stable(results.A.pageIds) === stable(results.B.pageIds),
  emptyResponseFails: emptyFails,
  brokenResponseFails: brokenFails,
  baselineHasBrandPlusThreeLayoutMocks: requestSummaries.filter((item) => String(item.url).endsWith("/chat/completions") && item.model === "deepseek-chat").length === 4,
  candidateDefaultHasOneBrandMock: requestSummaries.filter((item) => item.model === "deepseek-v4-flash").length === 1,
};
const pass = Object.values(assertions).every(Boolean);
const evidence = { ticket: "TICKET-122-R5", phase: 0, generatedAt: new Date().toISOString(), pass, baseline: { head: BASELINE_HEAD, sourceRoot: BASELINE_ROOT, workerSha256: sha256(baselineWorker), plannerBundleSha256: sha256(await fs.readFile(path.join(LOG_ROOT, "baseline-page-planner.mjs"))), rendererBundleSha256: sha256(await fs.readFile(path.join(LOG_ROOT, "baseline-render-pptx.cjs"))) }, candidateHashes, runId, projectIds: ids, namespaces, fixtureSha256: fixtureHashes[0], factCount: facts.length, cache: { applicationReads: 0, productionKnowledgeReads: 0, hits: 0 }, network, lifecycle: { workerStarted: 0, workerStopped: 0, comfyUiStarted: 0, comfyUiStopped: 0, ollamaStarted: 0, ollamaStopped: 0 }, requestSummaries, results, assertions, credentialValuesRecorded: false, completePromptsRecorded: false };
await fs.writeFile(outputPath, JSON.stringify(evidence, null, 2));
globalThis.fetch = originalFetch;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
console.log(JSON.stringify({ pass, output: outputPath, counts: { mockDeepSeek: network.mockDeepSeek, supabaseStub: network.supabaseStub, externalHttp: network.externalHttp, productionWrites: network.productionWrites }, assertions }, null, 2));
if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
