/**
 * TICKET-122-R7 Phase 2/3：清丽洗车真实 DeepSeek A/B（A1/A2=baseline deb2971，
 * B1/B2=120/121/R4 候选）+ 四份 PPTX 结构硬门。
 * 用法：
 *   npx tsx --env-file=.env.local scripts/_ab-fresh-customer-ab-122-r7.ts --ab
 *   npx tsx --env-file=.env.local scripts/_ab-fresh-customer-ab-122-r7.ts --gate
 * 依赖：logs/122-r5/source-fact-contract.json、asset-manifest.json、baseline-src/bundles。
 * 不打印/记录凭据值；DeepSeek 请求摘要仅记录非敏感字段。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

import { planPages as candidatePlanPages } from "../src/lib/vi-manual/page-planner";
import { renderPptxToBuffer as candidateRender } from "../src/lib/pptx/render-pptx";
import { guardedDeepSeekCall } from "../src/lib/core/billing/deepseek-guard";
import { normalizeDeepSeekResponseModel, calculateDeepSeekCost } from "../src/lib/core/billing/deepseek-pricing";
import { normalizeLogoTextLanguage } from "../src/lib/core/consultation-schema";

const ROOT = path.resolve(process.cwd());
const LOG_ROOT = path.join(ROOT, "logs", "122-r5");
const OUT_ROOT = path.join(ROOT, "logs", "122-r7");
const BASELINE_ROOT = path.join(LOG_ROOT, "baseline-src");
const BASELINE_HEAD = "deb2971d79fe088596126b88123bd62bdb7a936f";
const MAX_REAL_ATTEMPTS = 30;

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

// ===== 冻结 fixture（与 Phase 0 source-fact-contract.json 同源） =====
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

// ===== 网络包装：只放行 DeepSeek 真实调用与 data/blob；其余 fail-closed 并记录 =====
const originalFetch = globalThis.fetch;
const net = { deepSeekCalls: 0, blocked: [] as string[], externalHttp: 0 };
const requestRecords: Array<Record<string, unknown>> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (url.protocol === "data:" || url.protocol === "blob:") return originalFetch(request);
  if (url.hostname.endsWith("api.deepseek.com")) {
    net.deepSeekCalls += 1;
    if (net.deepSeekCalls > MAX_REAL_ATTEMPTS) throw new Error(`REAL_DEEPSEEK_ATTEMPTS_EXCEEDED ${MAX_REAL_ATTEMPTS}`);
    const started = Date.now();
    const raw = await request.clone().text();
    const body = JSON.parse(raw || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const response = await originalFetch(request);
    const respText = await response.clone().text();
    let parsed: any = null;
    try { parsed = JSON.parse(respText); } catch { /* keep null */ }
    const choice = parsed?.choices?.[0];
    const contentRaw = choice?.message?.content;
    const content = Array.isArray(contentRaw)
      ? contentRaw.map((p: any) => String(p?.text ?? p?.content ?? "")).join("")
      : String(contentRaw || "");
    const usage = parsed?.usage || {};
    const observedModel = String(parsed?.model || body.model || "");
    const isV4Model = /^deepseek-v4-(flash|pro)(-\d{4,8})?$/i.test(observedModel);
    const norm = isV4Model
      ? normalizeDeepSeekResponseModel(observedModel, (observedModel.startsWith("deepseek-v4-pro") ? "deepseek-v4-pro" : "deepseek-v4-flash") as any)
      : null;
    const cost = isV4Model && usage.prompt_tokens != null
      ? calculateDeepSeekCost(norm!.model, { promptTokens: usage.prompt_tokens, cachedPromptTokens: usage.prompt_cache_hit_tokens || 0, completionTokens: usage.completion_tokens || 0 }, new Date())
      : null;
    requestRecords.push({
      url: url.origin + url.pathname,
      method: request.method,
      model: body.model,
      thinking: body.thinking?.type || null,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      messageCount: messages.length,
      messageSha256: sha256(stable(messages)),
      httpStatus: response.status,
      responseModel: observedModel,
      normalizedModel: norm?.model || null,
      priced: isV4Model,
      finishReason: choice?.finish_reason || null,
      contentLength: content.length,
      contentSha256: sha256(content),
      contentIsArray: Array.isArray(contentRaw),
      reasoningLength: String(choice?.message?.reasoning || "").length,
      usage,
      costCny: cost?.totalCostCny ?? null,
      latencyMs: Date.now() - started,
    });
    return response;
  }
  net.externalHttp += 1;
  net.blocked.push(`${request.method} ${url.origin}${url.pathname}`);
  throw new Error(`R7_NETWORK_BLOCKED ${url.origin}${url.pathname}`);
}) as typeof fetch;

async function loadAssets() {
  const manifest = JSON.parse(await fs.readFile(path.join(LOG_ROOT, "asset-manifest.json"), "utf8"));
  const toDataUri = async (file: string) => {
    const buf = await fs.readFile(file);
    return `data:image/png;base64,${buf.toString("base64")}`;
  };
  const logo = manifest.logo.find((item: any) => item.semanticRole === "logo.primary.transparent");
  const sceneImages: Record<string, string> = {};
  for (const scene of manifest.scenes) sceneImages[scene.renderKey] = await toDataUri(scene.path);
  return { manifest, logoData: await toDataUri(logo.path), sceneImages };
}

async function realBaselineBrandCall(runtime: ReturnType<typeof productionPromptRuntime>, projectId: string) {
  const user = runtime.build(fixture);
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ""}` },
    body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: runtime.system }, { role: "user", content: user }], temperature: 0.7, max_tokens: 4096 }),
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(`A brand HTTP ${response.status}: ${sha256(JSON.stringify(data))}`);
  const parsed = runtime.parse(data.choices?.[0]?.message?.content || "");
  if (!Array.isArray(parsed.logoDesignSuggestions?.prompts) || !parsed.logoDesignSuggestions.prompts.length) throw new Error(`Empty baseline brand profile ${projectId}`);
  return parsed;
}

async function guardedCandidateBrandCall(runtime: ReturnType<typeof productionPromptRuntime>, projectId: string) {
  const user = runtime.build(fixture);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await guardedDeepSeekCall({
        route: "worker-brand-analysis",
        projectId,
        requestSummary: "Worker brand analysis",
        body: { model: "deepseek-v4-flash", messages: [{ role: "system", content: runtime.system }, { role: "user", content: user }], temperature: 0.7, max_tokens: 4096 },
        timeoutMs: 120_000,
      });
      const text = await response.clone().text();
      if (!response.ok) throw new Error(`B brand HTTP ${response.status}: ${sha256(text)}`);
      const data = JSON.parse(text) as any;
      const contentRaw = data.choices?.[0]?.message?.content;
      const content = Array.isArray(contentRaw)
        ? contentRaw.map((p: any) => String(p?.text ?? p?.content ?? "")).join("")
        : String(contentRaw || "");
      if (!content.trim()) throw new Error(`B brand empty content: status=${response.status} finish=${data.choices?.[0]?.finish_reason} choices=${data.choices?.length} contentIsArray=${Array.isArray(contentRaw)}`);
      const parsed = runtime.parse(content);
      if (!Array.isArray(parsed.logoDesignSuggestions?.prompts) || !parsed.logoDesignSuggestions.prompts.length) throw new Error(`Empty candidate brand profile ${projectId}`);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  throw new Error(`CANDIDATE_BRAND_FAILED_AFTER_3:${lastError}`);
}

async function executeRound(version: "A" | "B", projectId: string, assets: Awaited<ReturnType<typeof loadAssets>>) {
  const runtime = version === "A"
    ? productionPromptRuntime(await fs.readFile(path.join(BASELINE_ROOT, "scripts", "worker.mjs"), "utf8"))
    : productionPromptRuntime(await fs.readFile(path.join(ROOT, "scripts", "worker.mjs"), "utf8"));
  const profile: any = version === "A"
    ? await realBaselineBrandCall(runtime, projectId)
    : await guardedCandidateBrandCall(runtime, projectId);
  if (version === "A") process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "1";
  else delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
  const planner = version === "A" ? (await import(pathToFileURL(path.join(LOG_ROOT, "baseline-page-planner.mjs")).href + `?v=${Date.now()}`)).planPages : candidatePlanPages;
  const renderer = version === "A" ? (await import(pathToFileURL(path.join(LOG_ROOT, "baseline-render-pptx.cjs")).href + `?v=${Date.now()}`)).renderPptxToBuffer : candidateRender;
  const blueprints = await planner({
    clientInfo: {
      companyName: fixture.companyName,
      brandVision: profile.refinedBrandVision,
      coreValues: profile.refinedCoreValues,
      targetMarket: profile.refinedTargetMarket,
      logoPhilosophy: fixture.logoPhilosophy,
      industry: fixture.industry,
      brandPersonality: fixture.brandPersonality,
      location: fixture.location,
      storeScale: fixture.storeScale,
      customerMix: fixture.customerMix,
      mainProducts: fixture.mainProducts,
      description: fixture.description,
      colorPalette: fixture.colorPalette,
    },
    formalBrandName: fixture.formalBrandName,
    projectDisplayName: fixture.projectDisplayName,
    brandColors: { primary: fixture.colorPalette[0], secondary: fixture.colorPalette[1], accent: fixture.colorPalette[2] },
    wantMascot: "no",
    mascotAssets: {},
    assetAnalysis: { logo: { hasLogo: true, elements: ["水滴负形", "车身轮廓"], styleTags: ["现代", "清爽"], meaning: fixture.logoPhilosophy }, mascot: { hasMascot: false, name: "" } },
  });
  const pptx = await renderer(blueprints, {
    projectName: fixture.companyName,
    companyName: fixture.formalBrandName,
    industry: fixture.industry,
    logoData: assets.logoData,
    aiLogoData: assets.logoData,
    brandColors: { primary: "#0F6B6D", secondary: "#5CC8C4", accent: "#F5F2E8" },
    logoColors: ["#0F6B6D", "#5CC8C4", "#F5F2E8", "#263238"],
    logoElements: ["水滴负形", "车身轮廓"],
    brandVision: profile.refinedBrandVision,
    coreValues: profile.refinedCoreValues,
    targetMarket: profile.refinedTargetMarket,
    logoPhilosophy: fixture.logoPhilosophy,
    sceneImages: assets.sceneImages,
    sceneLabels: {},
    sceneSectionTitles: profile.sceneSectionTitles,
    compressImages: true,
    fullBrandName: fixture.companyName,
    englishName: "QINGLI CAR WASH",
  });
  const dir = path.join(OUT_ROOT, "ab", projectId);
  await fs.mkdir(dir, { recursive: true });
  const pptxPath = path.join(dir, "manual.pptx");
  await fs.writeFile(pptxPath, pptx);
  await fs.writeFile(path.join(dir, "blueprint.json"), JSON.stringify({ pageCount: blueprints.length, pageIds: blueprints.map((item: any) => item.pageId), blueprintHash: sha256(stable(blueprints)), profileHash: sha256(stable(profile)) }, null, 2));
  await fs.writeFile(path.join(dir, "brand-profile.json"), JSON.stringify({ version, profile, profileHash: sha256(stable(profile)) }, null, 2));
  return { version, projectId, pageCount: blueprints.length, pageIds: blueprints.map((item: any) => item.pageId), pptxPath, pptxBytes: pptx.length, profileHash: sha256(stable(profile)), blueprintHash: sha256(stable(blueprints)) };
}

async function runCanary() {
  const input = { companyName: fixture.companyName, mainProducts: fixture.mainProducts, city: fixture.city, industry: fixture.industry, projectId: "TEST-122-R5-QINGLI-CANARY" };
  const results: any = {};
  const versions = ["A", "B"] as const;
  for (const version of versions) {
    const srcRoot = version === "A" ? BASELINE_ROOT : ROOT;
    const geo = await import(pathToFileURL(path.join(srcRoot, "src/lib/brand/geo-context.ts")).href + `?v=${version}${Date.now()}`);
    const pos = await import(pathToFileURL(path.join(srcRoot, "src/lib/brand/brand-positioning-enhancer.ts")).href + `?v=${version}${Date.now()}`);
    const scale = await import(pathToFileURL(path.join(srcRoot, "src/lib/brand/company-scale.ts")).href + `?v=${version}${Date.now()}`);
    const geoCtx = await geo.inferGeoContext(input);
    const positioning = await pos.enhanceBrandPositioning({
      companyName: fixture.companyName,
      industry: fixture.industry,
      mainProducts: fixture.mainProducts,
      brandVision: fixture.brandVision,
      targetMarket: fixture.targetMarket,
      brandType: "社区服务型",
      brandPersona: ["可靠", "干净", "透明", "细致", "亲切"],
      geoContext: geoCtx,
    });
    const scaleResult = await scale.detectCompanyScale(fixture.legalEntity, fixture.industry, fixture.province, fixture.city);
    results[version] = { geo: { inferred: geoCtx.inferred, branch: geoCtx.inferred ? (net.deepSeekCalls > 0 ? "deepseek_called" : "cached") : "empty_no_key_or_fail" }, positioning: { enhanced: positioning.enhanced, positioning: positioning.positioning, branch: positioning.enhanced ? "deepseek_called" : "no_key_or_empty" }, companyScale: { scale: scaleResult.scale, confidence: scaleResult.confidence, branch: "rule_micro_no_call" } };
  }
  return results;
}

async function abMode() {
  await fs.mkdir(OUT_ROOT, { recursive: true });
  const assets = await loadAssets();
  const runId = `ab-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const ids = ["A1", "A2", "B1", "B2"].map((round) => `TEST-122-R5-QINGLI-${round}-${runId}`);
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const version = ids[i].includes("-A") ? "A" : "B";
    results.push(await executeRound(version, ids[i], assets));
    // 每轮即时落盘，防止中断丢失 DeepSeek 请求证据
    await fs.writeFile(path.join(OUT_ROOT, "deepseek-attempts.json"), JSON.stringify({ ticket: "TICKET-122-R7", attempts: requestRecords, totalCostCny: requestRecords.reduce((s, r) => s + (Number(r.costCny) || 0), 0), count: requestRecords.length }, null, 2));
  }
  const canary = await runCanary();
  const totalCost = requestRecords.reduce((sum, r) => sum + (Number(r.costCny) || 0), 0);
  const evidence = {
    ticket: "TICKET-122-R7", phase: 2, generatedAt: new Date().toISOString(),
    runId, projectIds: ids, baselineHead: BASELINE_HEAD,
    fixtureSha256: sha256(stable(fixture)),
    manifestSha256: sha256(await fs.readFile(path.join(LOG_ROOT, "asset-manifest.json"))),
    realDeepSeekCalls: net.deepSeekCalls, totalCostCny: totalCost,
    requestRecords, canary, results, blocked: net.blocked, externalHttp: net.externalHttp,
    credentialValuesRecorded: false, completePromptsRecorded: false,
  };
  await fs.writeFile(path.join(OUT_ROOT, "deepseek-attempts.json"), JSON.stringify({ ticket: "TICKET-122-R7", attempts: requestRecords, totalCostCny: totalCost, count: requestRecords.length }, null, 2));
  await fs.writeFile(path.join(OUT_ROOT, "brand-profile-ab.json"), JSON.stringify({ runId, results: results.map((r) => ({ version: r.version, projectId: r.projectId, profileHash: r.profileHash })) }, null, 2));
  await fs.writeFile(path.join(OUT_ROOT, "brand-agent-ab.json"), JSON.stringify({ canary }, null, 2));
  await fs.writeFile(path.join(OUT_ROOT, "latest-run.json"), JSON.stringify({ runId, dir: path.join(OUT_ROOT, "ab"), projectIds: ids, generatedAt: evidence.generatedAt }, null, 2));
  console.log(JSON.stringify({ ok: true, phase: 2, runId, realDeepSeekCalls: net.deepSeekCalls, totalCostCny: totalCost, results: results.map((r) => ({ version: r.version, projectId: r.projectId, pageCount: r.pageCount, pptxBytes: r.pptxBytes })), canary, blocked: net.blocked }, null, 2));
  await fs.writeFile(path.join(OUT_ROOT, "phase2-evidence.json"), JSON.stringify(evidence, null, 2));
}

// TICKET-122-R8：本地重渲染 4 份 PPTX（复用已存品牌档案 + 冻结 manifest；不调 DeepSeek）。
// A/B 均用修复后的当前代码（模板修复对所有版本生效），品牌文案仍来自各自真实档案。
async function renderMode() {
  const latest = JSON.parse(await fs.readFile(path.join(OUT_ROOT, "latest-run.json"), "utf8"));
  const assets = await loadAssets();
  const reRendered: any[] = [];
  for (const projectId of latest.projectIds) {
    const dir = path.join(latest.dir, projectId);
    const saved = JSON.parse(await fs.readFile(path.join(dir, "brand-profile.json"), "utf8"));
    const profile: any = saved.profile;
    if (saved.version === "A") process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "1";
    else delete process.env.DEEPSEEK_AI_LAYOUT_ENABLED;
    const blueprints = await candidatePlanPages({
      clientInfo: {
        companyName: fixture.companyName,
        brandVision: profile.refinedBrandVision,
        coreValues: profile.refinedCoreValues,
        targetMarket: profile.refinedTargetMarket,
        logoPhilosophy: fixture.logoPhilosophy,
        industry: fixture.industry,
        brandPersonality: fixture.brandPersonality,
        location: fixture.location,
        storeScale: fixture.storeScale,
        customerMix: fixture.customerMix,
        mainProducts: fixture.mainProducts,
        description: fixture.description,
        colorPalette: fixture.colorPalette,
      },
      formalBrandName: fixture.formalBrandName,
      projectDisplayName: fixture.projectDisplayName,
      brandColors: { primary: fixture.colorPalette[0], secondary: fixture.colorPalette[1], accent: fixture.colorPalette[2] },
      wantMascot: "no",
      mascotAssets: {},
      assetAnalysis: { logo: { hasLogo: true, elements: ["水滴负形", "车身轮廓"], styleTags: ["现代", "清爽"], meaning: fixture.logoPhilosophy }, mascot: { hasMascot: false, name: "" } },
    });
    const pptx = await candidateRender(blueprints, {
      projectName: fixture.companyName,
      companyName: fixture.formalBrandName,
      industry: fixture.industry,
      hasMascot: false,
      logoData: assets.logoData,
      aiLogoData: assets.logoData,
      brandColors: { primary: "#0F6B6D", secondary: "#5CC8C4", accent: "#F5F2E8" },
      logoColors: ["#0F6B6D", "#5CC8C4", "#F5F2E8", "#263238"],
      logoElements: ["水滴负形", "车身轮廓"],
      brandVision: profile.refinedBrandVision,
      coreValues: profile.refinedCoreValues,
      targetMarket: profile.refinedTargetMarket,
      logoPhilosophy: fixture.logoPhilosophy,
      sceneImages: assets.sceneImages,
      sceneLabels: {},
      sceneSectionTitles: profile.sceneSectionTitles,
      compressImages: true,
      fullBrandName: fixture.companyName,
      englishName: "QINGLI CAR WASH",
    });
    await fs.writeFile(path.join(dir, "manual.pptx"), pptx);
    await fs.writeFile(path.join(dir, "blueprint.json"), JSON.stringify({ pageCount: blueprints.length, pageIds: blueprints.map((item: any) => item.pageId), blueprintHash: sha256(stable(blueprints)), profileHash: sha256(stable(profile)), reRenderedAt: new Date().toISOString(), renderer: "r8-fixed" }, null, 2));
    reRendered.push({ projectId, version: saved.version, pageCount: blueprints.length, pptxBytes: pptx.length });
  }
  latest.reRenderedAt = new Date().toISOString();
  latest.renderer = "r8-fixed";
  await fs.writeFile(path.join(OUT_ROOT, "latest-run.json"), JSON.stringify(latest, null, 2));
  console.log(JSON.stringify({ ok: true, phase: "render-r8", reRendered }, null, 2));
}

// ===== Phase 3：结构硬门 =====
async function unzipPptx(pptxPath: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  execFileSync("tar", ["-xf", pptxPath, "-C", dest]);
}

function xmlText(xml: string): string {
  const texts: string[] = [];
  const re = /<a:t>([\s\S]*?)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) texts.push(m[1]);
  return texts.join("\n");
}

function overflowCheck(slideXml: string, slideW: number, slideH: number) {
  const issues: string[] = [];
  const spRe = /<p:sp>[\s\S]*?<\/p:sp>/g;
  let sp: RegExpExecArray | null;
  while ((sp = spRe.exec(slideXml))) {
    const body = sp[0];
    if (!/<a:t>/.test(body)) continue;
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/);
    const ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!off || !ext) continue;
    const x = Number(off[1]), y = Number(off[2]), cx = Number(ext[1]), cy = Number(ext[2]);
    if (x < 0 || y < 0 || x + cx > slideW || y + cy > slideH) {
      issues.push(`text-shape x=${x} y=${y} cx=${cx} cy=${cy} (slide ${slideW}x${slideH})`);
    }
  }
  return issues;
}

async function gateMode() {
  const latest = JSON.parse(await fs.readFile(path.join(OUT_ROOT, "latest-run.json"), "utf8"));
  const facts = (JSON.parse(await fs.readFile(path.join(LOG_ROOT, "source-fact-contract.json"), "utf8"))).facts as Array<{ id: string; value: unknown; synonyms: string[]; forbidden: string[]; severity: string }>;
  const report: any = { ticket: "TICKET-122-R7", phase: 3, generatedAt: new Date().toISOString(), runId: latest.runId, rounds: {} };
  let allPass = true;
  const roundSummaries: any[] = [];
  for (const projectId of latest.projectIds) {
    const pptxPath = path.join(latest.dir, projectId, "manual.pptx");
    const unpack = path.join(OUT_ROOT, "gate", projectId);
    await unzipPptx(pptxPath, unpack);
    const slidesDir = path.join(unpack, "ppt", "slides");
    const slideFiles = (await fs.readdir(slidesDir)).filter((f) => /^slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    const presXml = await fs.readFile(path.join(unpack, "ppt", "presentation.xml"), "utf8");
    const sldSz = presXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    const slideW = Number(sldSz?.[1] || 12192000);
    const slideH = Number(sldSz?.[2] || 6858000);
    const mediaDir = path.join(unpack, "ppt", "media");
    const mediaHashes: Array<{ name: string; sha256: string; bytes: number }> = [];
    let mediaDirExists = true;
    try { await fs.access(mediaDir); } catch { mediaDirExists = false; }
    if (mediaDirExists) {
      for (const f of await fs.readdir(mediaDir)) {
        const buf = await fs.readFile(path.join(mediaDir, f));
        mediaHashes.push({ name: f, sha256: sha256(buf), bytes: buf.length });
      }
    }
    const allText: string[] = [];
    const overflows: string[] = [];
    const slideXmlHashes: string[] = [];
    for (const f of slideFiles) {
      const xml = await fs.readFile(path.join(slidesDir, f), "utf8");
      slideXmlHashes.push(sha256(xml));
      allText.push(`[${f}] ${xmlText(xml)}`);
      overflows.push(...overflowCheck(xml, slideW, slideH).map((msg) => `${f}: ${msg}`));
    }
    const normalized = allText.join("\n").replace(/\s+/g, "").toLowerCase();
    const blueprint = JSON.parse(await fs.readFile(path.join(latest.dir, projectId, "blueprint.json"), "utf8"));
    const banWords = /禁止|不得|勿|避免|禁用|不可|严禁|不提供|不包含|不销售|不承接|不经营/;
    const factMatrix = facts.map((factItem) => {
      const values = [factItem.value, ...(factItem.synonyms || [])].map((v) => String(v).replace(/\s+/g, "").toLowerCase());
      if (factItem.id === "location.city") values.push("太原小店区");
      // 色值兼容：#5CC8C4 与 5CC8C4
      const variants = values.flatMap((v) => /^#[0-9a-f]{6}$/.test(v) ? [v, v.slice(1)] : [v]);
      const found = variants.some((v) => normalized.includes(v));
      const forbiddenHit: Array<{ term: string; negated: boolean }> = [];
      for (const term of (factItem.forbidden || []).map((f) => String(f).replace(/\s+/g, "").toLowerCase())) {
        let idx = normalized.indexOf(term);
        while (idx >= 0) {
          const windowText = normalized.slice(Math.max(0, idx - 40), idx + term.length + 40);
          forbiddenHit.push({ term, negated: banWords.test(windowText) });
          idx = normalized.indexOf(term, idx + term.length);
        }
      }
      const unnegatedForbidden = forbiddenHit.filter((h) => !h.negated);
      const forbiddenOnly = factItem.id === "ip.none" || factItem.id.startsWith("forbidden.");
      const pass = (forbiddenOnly ? true : (factItem.severity === "critical" ? found : true)) && unnegatedForbidden.length === 0;
      return { id: factItem.id, severity: factItem.severity, found, forbiddenHit, pass };
    });
    const criticalMiss = factMatrix.filter((f) => f.severity === "critical" && !f.pass);
    const forbiddenHits = factMatrix.filter((f) => f.forbiddenHit.some((h: any) => !h.negated));
    // IP 残留：展示性公仔/IP 文案（非「禁止/避免」上下文的公仔/吉祥物/IP形象）
    const ipCopyLines = allText
      .flatMap((line) => line.split("\n"))
      .filter((line) => /公仔|吉祥物|IP形象|IP 形象/.test(line) && !banWords.test(line))
      .filter((line) => line.trim().length > 0);
    const ipResidue = ipCopyLines.length > 0;
    // 名称契约：正式品牌名必须出现；旧项目/测试主体不得覆盖；李老板不得当品牌名
    const nameContract = {
      formalBrandNamePresent: normalized.includes("清丽洗车"),
      storeNamePresent: normalized.includes("清丽洗车场"),
      legalEntityAsBrand: /太原市小店区清丽汽车美容服务部/.test(normalized) && !normalized.includes("清丽洗车"),
      oldProjectLeak: /百疗萃|萃瑶|jik0|招财进堡/.test(normalized),
      ownerAsBrand: normalized.includes("李老板") && !normalized.includes("清丽洗车"),
    };
    const nameOk = nameContract.formalBrandNamePresent && !nameContract.legalEntityAsBrand && !nameContract.oldProjectLeak && !nameContract.ownerAsBrand;
    const roundPass = criticalMiss.length === 0 && forbiddenHits.length === 0 && !ipResidue && overflows.length === 0 && nameOk;
    roundSummaries.push({ projectId, pageIds: blueprint.pageIds, pageCount: blueprint.pageCount, mediaHashes: mediaHashes.map((m) => m.sha256), slideXmlHashes });
    allPass = allPass && roundPass;
    report.rounds[projectId] = {
      pptxSha256: sha256(await fs.readFile(pptxPath)),
      pptxBytes: (await fs.stat(pptxPath)).size,
      pageCount: slideFiles.length,
      slideNames: slideFiles,
      slideW, slideH,
      slideXmlHashes,
      blueprintPageIds: blueprint.pageIds,
      blueprintPageCount: blueprint.pageCount,
      mediaCount: mediaHashes.length,
      mediaHashes,
      overflows,
      factTotal: factMatrix.length,
      factPass: factMatrix.filter((f) => f.pass).length,
      criticalMiss: criticalMiss.map((f) => f.id),
      forbiddenHits: forbiddenHits.map((f) => ({ id: f.id, hits: f.forbiddenHit })),
      ipResidue,
      ipCopyLines,
      nameContract,
      textSample: allText.join("\n").slice(0, 3000),
      pass: roundPass,
    };
  }
  const base = roundSummaries[0];
  const structuralConsistency = roundSummaries.every((s) =>
    stable(s.pageIds) === stable(base.pageIds) &&
    s.pageCount === base.pageCount &&
    stable(s.mediaHashes) === stable(base.mediaHashes)
  );
  report.structuralConsistencyAcrossRounds = structuralConsistency;
  report.allPass = allPass;
  allPass = allPass && structuralConsistency;
  report.allPass = allPass;
  // R5 工单 Phase 3.5：逐页内容证据文件
  const pageByPage: string[] = [`# Page-by-page content AB（R8 重渲染）`, `runId: ${latest.runId}`, ""];
  for (const [projectId, round] of Object.entries(report.rounds as Record<string, any>)) {
    pageByPage.push(`## ${projectId}`, `pages: ${round.pageCount} | media: ${round.mediaCount} | pass: ${round.pass}`, "");
    for (const f of round.slideNames) {
      const xml = await fs.readFile(path.join(OUT_ROOT, "gate", projectId, "ppt", "slides", f), "utf8");
      pageByPage.push(`### ${f}`, xmlText(xml), "");
    }
  }
  await fs.writeFile(path.join(OUT_ROOT, "page-by-page-content-ab.md"), pageByPage.join("\n"), "utf8");
  await fs.writeFile(path.join(OUT_ROOT, "phase3-gate.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, phase: 3, allPass, rounds: Object.fromEntries(Object.entries(report.rounds).map(([k, v]: any) => [k, { pageCount: v.pageCount, mediaCount: v.mediaCount, factPass: `${v.factPass}/${v.factTotal}`, criticalMiss: v.criticalMiss, overflows: v.overflows.length, ipResidue: v.ipResidue, pass: v.pass }])) }, null, 2));
  if (!allPass) process.exitCode = 1;
}

async function main() {
  if (process.argv.includes("--ab")) return abMode();
  if (process.argv.includes("--render")) return renderMode();
  if (process.argv.includes("--gate")) return gateMode();
  throw new Error("Use --ab (Phase 2), --render (R8 re-render) or --gate (Phase 3)");
}

main().catch((error) => {
  globalThis.fetch = originalFetch;
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
