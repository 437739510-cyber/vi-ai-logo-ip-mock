/**
 * TICKET-122-R2: frozen local POLP input, two real DeepSeek layout rounds,
 * deterministic baseline, PPTX structure/media identity evidence.
 *
 * Run only with the ticket-authorized local env loader:
 *   node --env-file=.env.local --import tsx scripts/_ab-real-deepseek-layout-122-r2.ts
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import * as pricing from "../src/lib/core/billing/deepseek-pricing";

const ROOT = "D:/disk/HermesDisk/bb-clean";
const BASE_OUT = path.join(ROOT, "logs/122-r2");
const runId = `run-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${crypto.randomBytes(6).toString("hex")}`;
const RUN_DIR = path.join(BASE_OUT, runId);
const TARGET_PAGES = ["cover", "logo-interpretation", "summary"] as const;
const VARIANTS = ["A1", "A2", "B"] as const;
const EXACT_DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const MAX_ATTEMPTS = 18;
const MAX_ATTEMPTS_PER_PAGE = 3;
const REQUIRED_SUCCESSES = 6;
const TEST_TIMEOUT_MS = 120_000;
const SUPABASE_ORIGIN = "https://fzoscrutqhdfzwnjgjvs.supabase.co";

type Variant = typeof VARIANTS[number];
type ManifestItem = {
  field: string;
  pageId: string;
  semanticRole: string;
  sourceAbsolutePath: string;
  sourceSha256: string;
  bytes: number;
  mime: string;
  dataUri: string;
};
type ImageTrace = {
  slideIndex: number;
  slotIndex: number;
  expectedRole: string;
  expectedSha256: string;
  sourceAbsolutePath: string;
};

function sha256(data: crypto.BinaryLike): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function ensureFreshRun(): void {
  if (fs.existsSync(RUN_DIR)) throw new Error(`runId already exists: ${RUN_DIR}`);
  fs.mkdirSync(BASE_OUT, { recursive: true });
  fs.mkdirSync(RUN_DIR, { recursive: false });
}

function sourceAsset(field: string, pageId: string, semanticRole: string, sourceAbsolutePath: string): ManifestItem {
  const bytes = fs.readFileSync(sourceAbsolutePath);
  const mime = /\.jpe?g$/i.test(sourceAbsolutePath) ? "image/jpeg" : "image/png";
  return {
    field,
    pageId,
    semanticRole,
    sourceAbsolutePath: path.resolve(sourceAbsolutePath),
    sourceSha256: sha256(bytes),
    bytes: bytes.length,
    mime,
    dataUri: `data:${mime};base64,${bytes.toString("base64")}`,
  };
}

function decodeDataUri(data: string): Buffer | null {
  const match = String(data).match(/^data:[^;,]+;base64,(.*)$/s);
  return match ? Buffer.from(match[1], "base64") : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const assetDefs = [
  ["logoData", "global", "logo.primary", "logs/092/c1.png"],
  ["mascotAssets.front", "mascot-threeview", "mascot.front", "logs/092/staging/front-定稿.png"],
  ["mascotAssets.side", "mascot-threeview", "mascot.side", "logs/092/staging/side-928471603.png"],
  ["mascotAssets.back", "mascot-threeview", "mascot.back", "logs/108/staging/背面单图-620002.png"],
  ...["微笑", "开心", "安心", "引导", "专注", "俏皮"].map((name) => [
    `mascotAssets.emotions.${name}`, "mascot-emotions", `mascot.emotion.${name}`, `logs/094/staging/新建文件夹/${name}-v2.png`,
  ]),
  ...[["门店迎宾", "迎宾"], ["会员服务", "会员服务"], ["美甲", "美甲"], ["社媒传播", "社媒传播"]].map(([name, file]) => [
    `mascotAssets.scenes.${name}`, "mascot-scenes", `mascot.scene.${name}`, `logs/094/staging/新建文件夹/${file}-v2.png`,
  ]),
  ["sceneImages.stationery-1", "stationery", "application.stationery.primary", "logs/105/overlay/stationery-overlay.png"],
  ["sceneImages.stationery-2", "stationery", "application.stationery.letterhead", "logs/108/staging/信纸函头-610001.png"],
  ["sceneImages.packaging-1", "packaging", "application.packaging.shopping-bag", "logs/105/overlay/shopping-bag-overlay.png"],
  ["sceneImages.packaging-2", "packaging", "application.packaging.box", "logs/105/overlay/packaging-box-overlay.png"],
  ["sceneImages.marketing-1", "marketing", "application.marketing.poster", "logs/105/overlay/poster-overlay.png"],
  ["sceneImages.marketing-2", "marketing", "application.marketing.badge", "logs/105/overlay/badge-overlay.png"],
  ["wayfindingInjection", "wayfinding", "application.wayfinding.real-scene", "logs/105/staging/导视门头-r5-557007.png"],
] as const;

const assetManifest = assetDefs.map(([field, pageId, role, rel]) => sourceAsset(field, pageId, role, path.join(ROOT, rel)));
const byRole = new Map(assetManifest.map((item) => [item.semanticRole, item]));
const bySha = new Map(assetManifest.map((item) => [item.sourceSha256, item]));
if (bySha.size !== assetManifest.length) throw new Error("Source assets are not one-to-one by SHA-256");

const get = (role: string) => {
  const item = byRole.get(role);
  if (!item) throw new Error(`Missing semantic asset: ${role}`);
  return item.dataUri;
};

const emotions = ["微笑", "开心", "安心", "引导", "专注", "俏皮"].map((name) => ({
  name,
  url: get(`mascot.emotion.${name}`),
}));
const scenes = ["门店迎宾", "会员服务", "美甲", "社媒传播"].map((name) => ({
  name,
  url: get(`mascot.scene.${name}`),
}));
const front = get("mascot.front");
const side = get("mascot.side");
const back = get("mascot.back");
const logo = get("logo.primary");

const clientInfo = Object.freeze({
  companyName: "百疗萃养生馆",
  brandVision: "让每一次到访都成为焕发自信的疗愈之旅。",
  brandSlogan: "变美了、自信了",
  coreValues: "专业呵护,传统智慧,温馨亲民,匠心手作,自信之美",
  targetMarket: "25-45岁都市女性，注重健康与自我投资，追求品质生活与情感归属，偏好社区化、有温度的服务体验。",
  logoPhilosophy: "水滴与叶片：滋养渗透、自然生机、健康养护",
  industry: "美业",
  brandPersonality: "温婉可靠，带着传统养生的智慧与亲近感，传递自信与呵护",
  mascotName: "萃瑶",
  wantMascot: "yes",
});
const brandColors = Object.freeze({
  primary: { hex: "#B76E79", name: "主色（玫瑰金）" },
  secondary: { hex: "#D4AF7A", name: "辅助色" },
  accent: { hex: "#E8C4A0", name: "强调色" },
});
const mascotAssets = Object.freeze({ name: "萃瑶", front, side, back, emotions, scenes });
const plannerInput = Object.freeze({
  clientInfo,
  formalBrandName: "百疗萃养生馆",
  projectDisplayName: "百疗萃养生馆",
  brandColors,
  wantMascot: "yes",
  // Deliberately missing sentinel: bypasses industry template-index lookup while
  // preserving the real industry in page content and DeepSeek context.
  templateId: `__TICKET_122_R2_NO_TEMPLATE_${runId}__`,
  mascotAssets,
  assetAnalysis: {
    logo: { hasLogo: true, elements: ["水滴", "叶片"], styleTags: [], meaning: clientInfo.logoPhilosophy },
    mascot: { hasMascot: true, name: "萃瑶" },
  },
});
const renderOptions = Object.freeze({
  projectName: "百疗萃养生馆",
  companyName: "百疗萃养生馆",
  industry: "美业",
  logoData: logo,
  aiLogoData: logo,
  brandColors: { primary: "#B76E79", secondary: "#D4AF7A", accent: "#E8C4A0" },
  logoElements: ["水滴", "叶片"],
  brandVision: clientInfo.brandVision,
  slogan: clientInfo.brandSlogan,
  coreValues: clientInfo.coreValues,
  targetMarket: clientInfo.targetMarket,
  logoPhilosophy: clientInfo.logoPhilosophy,
  sceneImages: {
    "stationery-1": get("application.stationery.primary"),
    "stationery-2": get("application.stationery.letterhead"),
    "packaging-1": get("application.packaging.shopping-bag"),
    "packaging-2": get("application.packaging.box"),
    "marketing-1": get("application.marketing.poster"),
    "marketing-2": get("application.marketing.badge"),
  },
  compressImages: false,
  fullBrandName: "百疗萃养生馆",
  mascotData: front,
  mascotSplitViews: [front, side, back],
  mascotEmotions: Object.fromEntries(emotions.map((item) => [item.name, item.url])),
  mascotScenes: Object.fromEntries(scenes.map((item) => [item.name, item.url])),
  mascotThreeViewData: null,
});

const inputEvidence = {
  runId,
  createdAt: new Date().toISOString(),
  frozenInputSha256: sha256(stableJson(plannerInput)),
  frozenRenderOptionsSha256: sha256(stableJson(renderOptions)),
  sourceAssetManifestSha256: sha256(stableJson(assetManifest.map(({ dataUri: _omit, ...item }) => item))),
  oldPptxInputs: 0,
  oldBlueprintInputs: 0,
  oldMediaInputs: 0,
  cacheReads: 0,
};

const originalFetch = globalThis.fetch;
let blockedNetworkRequests = 0;
let deepseekNetworkRequests = 0;
let activeCall: { round: string; pageId: string; attempt: number; pageAttempt: number; canary: boolean } | null = null;
const callEvidence: any[] = [];
let cumulativeCostCny = 0;
let usageStubId = 0;
const supabaseStubEvidence: any[] = [];
const blockedNetworkEvidence: any[] = [];

process.env.DEEPSEEK_MODEL = "deepseek-v4-flash";

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (url.startsWith(`${SUPABASE_ORIGIN}/rest/v1/api_usage_log`)) {
    const stage = method === "GET" ? "precheck-select" : method === "POST" ? "precheck-insert" : method === "PATCH" ? "postlog-update" : "unknown";
    supabaseStubEvidence.push({ url, method, stage, at: new Date().toISOString(), activeCall: activeCall ? { ...activeCall } : null, externalIo: false });
    if (stage === "unknown") throw new Error(`UNEXPECTED_SUPABASE_STUB_METHOD:${method}`);
    const responseBody = method === "POST" ? JSON.stringify([{ id: ++usageStubId }]) : JSON.stringify([]);
    return new Response(responseBody, {
      status: method === "POST" ? 201 : 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
    });
  }
  if (url !== EXACT_DEEPSEEK_URL) {
    blockedNetworkRequests += 1;
    blockedNetworkEvidence.push({ url, method, at: new Date().toISOString(), activeCall: activeCall ? { ...activeCall } : null });
    throw new Error(`NETWORK_ALLOWLIST_BLOCK:${url}`);
  }
  if (!activeCall) throw new Error("DeepSeek request without active call metadata");
  deepseekNetworkRequests += 1;
  const startedAt = new Date();
  const record: any = {
    ...activeCall,
    requestedModel: "deepseek-v4-flash",
    url,
    startedAt: startedAt.toISOString(),
    testTimeoutMs: TEST_TIMEOUT_MS,
    productionSignalReceived: Boolean(init?.signal),
    testSignalOverrideApplied: true,
    obtainedHttpResponse: false,
    httpStatus: null,
    usage: null,
    cost: null,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`TEST_TIMEOUT_${TEST_TIMEOUT_MS}MS`)), TEST_TIMEOUT_MS);
  try {
    const response = await originalFetch(input as any, { ...init, signal: controller.signal });
    record.obtainedHttpResponse = true;
    record.httpStatus = response.status;
    const responseText = await response.clone().text();
    record.responseSha256 = sha256(responseText);
    const body = JSON.parse(responseText);
    record.observedModel = typeof body.model === "string" ? body.model : null;
    record.usage = body.usage || null;
    if (response.ok) {
      if (!body.usage || !Number.isFinite(body.usage.prompt_tokens) || !Number.isFinite(body.usage.completion_tokens)) {
        throw new Error("USAGE_MISSING_OR_INVALID");
      }
      const normalized = pricing.normalizeDeepSeekResponseModel(body.model, "deepseek-v4-flash");
      if (normalized.warning || normalized.model !== "deepseek-v4-flash") {
        throw new Error(`UNKNOWN_OR_UNSAFE_MODEL:${String(body.model)}`);
      }
      record.normalizedModel = normalized.model;
      record.modelSource = normalized.source;
      const cost = pricing.calculateDeepSeekCost(normalized.model, {
        promptTokens: body.usage.prompt_tokens,
        cachedPromptTokens: body.usage.prompt_cache_hit_tokens || 0,
        completionTokens: body.usage.completion_tokens,
      }, startedAt);
      record.cost = cost;
      cumulativeCostCny += cost.totalCostCny;
      record.cumulativeCostCny = cumulativeCostCny;
    }
    record.finishedAt = new Date().toISOString();
    record.elapsedMs = Date.now() - startedAt.getTime();
    record.productionSignalAbortedAtFinish = Boolean(init?.signal?.aborted);
    if (record.evidenceError) throw new Error(record.evidenceError);
    return response;
  } catch (error) {
    const failedAt = new Date();
    record.failedAt = failedAt.toISOString();
    record.elapsedMs = failedAt.getTime() - startedAt.getTime();
    record.errorName = error instanceof Error ? error.name : "UnknownError";
    record.errorMessage = error instanceof Error ? error.message : String(error);
    record.abortOrTimeout = controller.signal.aborted || (error instanceof Error && (error.name === "AbortError" || /timeout|aborted/i.test(error.message)));
    record.productionSignalAbortedAtFailure = Boolean(init?.signal?.aborted);
    throw error;
  } finally {
    clearTimeout(timeout);
    callEvidence.push(record);
  }
}) as typeof fetch;

const imageTraces: Record<Variant, Record<number, ImageTrace[]>> = { A1: {}, A2: {}, B: {} };
let currentVariant: Variant | null = null;
const originalAddSlide = PptxGenJS.prototype.addSlide;
PptxGenJS.prototype.addSlide = function tracedAddSlide(...args: any[]): any {
  const slide = originalAddSlide.apply(this, args as any);
  const slideIndex = ((this as any)._slides?.length || 1);
  const addImage = slide.addImage.bind(slide);
  slide.addImage = (opts: any) => {
    if (currentVariant && typeof opts?.data === "string") {
      const raw = decodeDataUri(opts.data);
      if (!raw) throw new Error(`Non-data-URI image on slide ${slideIndex}`);
      const imageSha = sha256(raw);
      const source = bySha.get(imageSha);
      const trace = imageTraces[currentVariant][slideIndex] ||= [];
      trace.push({
        slideIndex,
        slotIndex: trace.length + 1,
        expectedRole: source?.semanticRole || `generated.local.${imageSha.slice(0, 16)}`,
        expectedSha256: imageSha,
        sourceAbsolutePath: source?.sourceAbsolutePath || "[generated-in-process]",
      });
    }
    return addImage(opts);
  };
  return slide;
} as typeof PptxGenJS.prototype.addSlide;

function validAiElements(elements: any[]): any[] {
  const validTypes = new Set(["logo", "text", "ip-mascot", "color-swatch", "decoration", "divider", "image"]);
  const validPositions = new Set(["top-center", "center", "bottom-center", "bottom-right", "left", "right"]);
  return elements.filter((el) => el && validTypes.has(el.type) && (!el.position || validPositions.has(el.position)));
}

async function injectWayfinding(pptx: Buffer, variant: Variant): Promise<Buffer> {
  const source = byRole.get("application.wayfinding.real-scene")!;
  const bytes = decodeDataUri(source.dataUri)!;
  const zip = await JSZip.loadAsync(pptx);
  const mediaName = "ppt/media/image-wayfinding-122-r2.png";
  zip.file(mediaName, bytes);
  const relsPath = "ppt/slides/_rels/slide19.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) throw new Error(`${variant}: missing ${relsPath}`);
  const rels = await relsFile.async("string");
  const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const nextId = Math.max(0, ...ids) + 1;
  const rel = `<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image-wayfinding-122-r2.png"/>`;
  zip.file(relsPath, rels.replace("</Relationships>", rel + "</Relationships>"));
  const slidePath = "ppt/slides/slide19.xml";
  const slideFile = zip.file(slidePath);
  if (!slideFile) throw new Error(`${variant}: missing ${slidePath}`);
  const xml = await slideFile.async("string");
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="9001" name="Wayfinding122R2"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId${nextId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="5290000" y="6995000"/><a:ext cx="1280160" cy="1280160"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  if (!xml.includes("</p:spTree>")) throw new Error(`${variant}: slide19 spTree missing`);
  zip.file(slidePath, xml.replace("</p:spTree>", pic + "</p:spTree>"));
  const trace = imageTraces[variant][19] ||= [];
  trace.push({ slideIndex: 19, slotIndex: trace.length + 1, expectedRole: source.semanticRole, expectedSha256: source.sourceSha256, sourceAbsolutePath: source.sourceAbsolutePath });
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function xmlDecode(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function inspectPptx(filePath: string, variant: Variant, pageIds: string[]): Promise<any> {
  const bytes = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(bytes);
  const slides: any[] = [];
  for (let i = 1; i <= pageIds.length; i += 1) {
    const slidePath = `ppt/slides/slide${i}.xml`;
    const relsPath = `ppt/slides/_rels/slide${i}.xml.rels`;
    const slideXml = await zip.file(slidePath)!.async("string");
    const relsXml = zip.file(relsPath) ? await zip.file(relsPath)!.async("string") : "";
    const relMap = new Map<string, string>();
    for (const match of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>(?:<\/Relationship>)?/g)) {
      relMap.set(match[1], match[2]);
    }
    const pictures: any[] = [];
    for (const match of slideXml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
      const block = match[1];
      const relId = block.match(/<a:blip[^>]*r:embed="([^"]+)"/)?.[1] || "";
      const shapeName = xmlDecode(block.match(/<p:cNvPr[^>]*name="([^"]*)"/)?.[1] || "");
      const target = relMap.get(relId) || "";
      const normalized = path.posix.normalize(path.posix.join("ppt/slides", target));
      const mediaFile = zip.file(normalized);
      const mediaBytes = mediaFile ? await mediaFile.async("nodebuffer") : null;
      pictures.push({
        shapeIndex: pictures.length + 1,
        shapeName,
        relationship: relId,
        target,
        actualSha256: mediaBytes ? sha256(mediaBytes) : null,
        relationshipOk: Boolean(mediaBytes),
        transform: block.match(/<a:xfrm[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0] || "",
      });
    }
    const expected = imageTraces[variant][i] || [];
    const slotRows = pictures.map((pic, index) => ({
      pageId: pageIds[i - 1],
      slideIndex: i,
      shape: pic.shapeName,
      relationship: pic.relationship,
      expectedRole: expected[index]?.expectedRole || "UNEXPECTED_IMAGE_SLOT",
      expectedSha256: expected[index]?.expectedSha256 || null,
      actualSha256: pic.actualSha256,
      match: Boolean(expected[index] && pic.relationshipOk && expected[index].expectedSha256 === pic.actualSha256),
      transform: pic.transform,
    }));
    if (expected.length > pictures.length) {
      for (let index = pictures.length; index < expected.length; index += 1) {
        slotRows.push({ pageId: pageIds[i - 1], slideIndex: i, shape: "MISSING", relationship: null, expectedRole: expected[index].expectedRole, expectedSha256: expected[index].expectedSha256, actualSha256: null, match: false, transform: "" });
      }
    }
    const text = [...slideXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => xmlDecode(m[1])).join("\n").replace(/\r\n/g, "\n");
    const shapes = [...slideXml.matchAll(/<(p:sp|p:pic|p:graphicFrame)>([\s\S]*?)<\/\1>/g)].map((m, index) => ({
      index: index + 1,
      type: m[1],
      signatureSha256: sha256(m[2].replace(/rId\d+/g, "rId#")),
      transform: m[2].match(/<a:xfrm[^>]*>[\s\S]*?<\/a:xfrm>/)?.[0] || "",
    }));
    slides.push({
      slideIndex: i,
      pageId: pageIds[i - 1],
      normalizedText: text,
      normalizedTextSha256: sha256(text),
      rawSlideXmlSha256: sha256(slideXml),
      pictures,
      slotRows,
      shapes,
      allRelationshipsOk: pictures.every((p) => p.relationshipOk),
      allSlotsMatch: slotRows.length === expected.length && slotRows.every((row) => row.match),
    });
  }
  return { filePath, bytes: bytes.length, sha256: sha256(bytes), slides };
}

async function main(): Promise<void> {
  ensureFreshRun();
  fs.writeFileSync(path.join(RUN_DIR, "source-asset-manifest.json"), JSON.stringify({ ...inputEvidence, assets: assetManifest.map(({ dataUri: _omit, ...item }) => item) }, null, 2), "utf8");

  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY_NOT_CONFIGURED");

  // Import only after the Supabase no-I/O stub and network allowlist are installed.
  const [{ planPages }, { planLayoutEngine }, { renderPptxToBuffer }] = await Promise.all([
    import("../src/lib/vi-manual/page-planner"),
    import("../src/lib/vi-manual/plan-layout-engine"),
    import("../src/lib/pptx/render-pptx"),
  ]);

  process.env.DEEPSEEK_AI_LAYOUT_ENABLED = "0";
  const baseline = await planPages(clone(plannerInput) as any);
  if (baseline.length !== 33) throw new Error(`PAGE_COUNT_MISMATCH:${baseline.length}`);
  const baselineSnapshot = stableJson(baseline);
  const layoutParams: any = {
    companyName: "百疗萃养生馆",
    industry: clientInfo.industry,
    brandVision: clientInfo.brandVision,
    coreValues: clientInfo.coreValues,
    targetMarket: clientInfo.targetMarket,
    brandTone: clientInfo.brandPersonality,
    brandColors,
    hasLogo: true,
    logoElements: ["水滴", "叶片"],
    logoMeaning: clientInfo.logoPhilosophy,
    logoStyleTags: [],
    hasMascot: true,
    mascotName: "萃瑶",
    mascotStyle: "温婉人类女神 IP 公仔",
    mascotPersonality: clientInfo.brandPersonality,
  };
  const aiByRound: Record<"A1" | "A2", Record<string, any[]>> = { A1: {}, A2: {} };
  let successes = 0;
  let attempts = 0;
  for (const round of ["A1", "A2"] as const) {
    for (const pageId of TARGET_PAGES) {
      let accepted = false;
      let pageAttempts = 0;
      const canary = round === "A1" && pageId === "cover";
      while (!accepted && pageAttempts < MAX_ATTEMPTS_PER_PAGE) {
        if (attempts >= MAX_ATTEMPTS) throw new Error(`ATTEMPT_CAP_REACHED:${attempts}`);
        attempts += 1;
        pageAttempts += 1;
        activeCall = { round, pageId, attempt: attempts, pageAttempt: pageAttempts, canary };
        let result: any;
        try {
          result = await planLayoutEngine({ ...layoutParams, pageId });
        } finally {
          activeCall = null;
        }
        const record = callEvidence.at(-1);
        if (record && record.attempt === attempts) {
          record.engineSuccess = result.success;
          record.engineError = result.error || null;
          record.elementsCountBeforeValidation = result.elements?.length || 0;
        }
        if (!result.success || !Array.isArray(result.elements)) continue;
        const valid = validAiElements(result.elements);
        if (record) record.elementsCountAfterValidation = valid.length;
        if (valid.length === 0) continue;
        aiByRound[round][pageId] = valid;
        successes += 1;
        accepted = true;
      }
      if (!accepted) {
        throw new Error(canary
          ? `CANARY_FAILED_AFTER_${pageAttempts}_ATTEMPTS`
          : `PAGE_FAILED_AFTER_${pageAttempts}_ATTEMPTS:${round}/${pageId}`);
      }
    }
  }
  if (successes !== REQUIRED_SUCCESSES || attempts > MAX_ATTEMPTS) {
    throw new Error(`CALL_HARD_GATE:successes=${successes},attempts=${attempts},cost=${cumulativeCostCny}`);
  }
  if (stableJson(baseline) !== baselineSnapshot) throw new Error("FROZEN_BASELINE_MUTATED_DURING_CALLS");

  const blueprintsByVariant: Record<Variant, any[]> = { B: clone(baseline), A1: clone(baseline), A2: clone(baseline) };
  for (const round of ["A1", "A2"] as const) {
    for (const pageId of TARGET_PAGES) {
      const page = blueprintsByVariant[round].find((item) => item.pageId === pageId);
      if (!page) throw new Error(`${round}: missing page ${pageId}`);
      page.elements = clone(aiByRound[round][pageId]);
    }
  }
  fs.writeFileSync(path.join(RUN_DIR, "deepseek-calls.json"), JSON.stringify({ successes, attempts, cumulativeCostCny, calls: callEvidence }, null, 2), "utf8");
  fs.writeFileSync(path.join(RUN_DIR, "blueprints.json"), JSON.stringify({
    baselineSha256: sha256(stableJson(baseline)),
    A1: blueprintsByVariant.A1,
    A2: blueprintsByVariant.A2,
    B: blueprintsByVariant.B,
  }, null, 2), "utf8");

  const outputs: Record<Variant, string> = {
    A1: path.join(RUN_DIR, "manual-A1-real-ai-layout.pptx"),
    A2: path.join(RUN_DIR, "manual-A2-real-ai-layout.pptx"),
    B: path.join(RUN_DIR, "manual-B-deterministic-layout.pptx"),
  };
  for (const variant of VARIANTS) {
    currentVariant = variant;
    let pptx = await renderPptxToBuffer(clone(blueprintsByVariant[variant]), clone(renderOptions) as any);
    pptx = await injectWayfinding(pptx, variant);
    fs.writeFileSync(outputs[variant], pptx, { flag: "wx" });
    currentVariant = null;
  }

  const pageIds = baseline.map((item: any) => item.pageId);
  const structures: Record<Variant, any> = {} as any;
  for (const variant of VARIANTS) structures[variant] = await inspectPptx(outputs[variant], variant, pageIds);

  const targetSet = new Set<string>(TARGET_PAGES);
  const comparisonRows: any[] = [];
  let structurePass = true;
  for (let i = 0; i < pageIds.length; i += 1) {
    const slides = VARIANTS.map((variant) => structures[variant].slides[i]);
    const textSame = new Set(slides.map((slide) => slide.normalizedTextSha256)).size === 1;
    const mediaMultisets = slides.map((slide) => stableJson(slide.slotRows.map((row: any) => row.actualSha256).sort()));
    const mediaSame = new Set(mediaMultisets).size === 1;
    const slotsPass = slides.every((slide) => slide.allSlotsMatch && slide.allRelationshipsOk);
    const nonTargetExact = targetSet.has(pageIds[i]) || new Set(slides.map((slide) => slide.rawSlideXmlSha256)).size === 1;
    const row = { slideIndex: i + 1, pageId: pageIds[i], textSame, mediaSame, slotsPass, nonTargetExact };
    comparisonRows.push(row);
    if (!textSame || !mediaSame || !slotsPass || !nonTargetExact) structurePass = false;
  }

  const uniqueRoles = [
    "mascot.front", "mascot.side", "mascot.back",
    ...["微笑", "开心", "安心", "引导", "专注", "俏皮"].map((name) => `mascot.emotion.${name}`),
    ...["门店迎宾", "会员服务", "美甲", "社媒传播"].map((name) => `mascot.scene.${name}`),
  ];
  const uniqueness: any[] = [];
  for (const variant of VARIANTS) {
    const rows = structures[variant].slides.flatMap((slide: any) => slide.slotRows);
    for (const role of uniqueRoles) {
      const sourceSha = byRole.get(role)!.sourceSha256;
      const expectedCount = imageTraces[variant]
        ? Object.values(imageTraces[variant]).flat().filter((item) => item.expectedRole === role).length
        : 0;
      const actualCount = rows.filter((row: any) => row.actualSha256 === sourceSha).length;
      const pass = expectedCount > 0 && expectedCount === actualCount;
      uniqueness.push({ variant, semanticRole: role, sourceSha256: sourceSha, expectedCount, actualCount, pass });
      if (!pass) structurePass = false;
    }
  }

  const cacheFailures = VARIANTS.flatMap((variant) => structures[variant].slides.flatMap((slide: any) =>
    slide.slotRows.filter((row: any) => !row.match).map((row: any) => ({ variant, ...row, code: "CACHE_OR_ASSET_MAPPING_FAIL" })),
  ));
  if (cacheFailures.length > 0) structurePass = false;

  const evidence = {
    runId,
    runDirectory: RUN_DIR,
    inputEvidence,
    credentials: { deepseekApiKeyConfigured: true },
    network: { allowedTarget: EXACT_DEEPSEEK_URL, deepseekNetworkRequests, blockedNetworkRequests, blockedNetworkEvidence },
    production: { supabaseNetworkRequests: 0, storageNetworkRequests: 0, orderNetworkRequests: 0, productionWrites: 0, localSupabaseStubRequests: supabaseStubEvidence.length, supabaseStubEvidence },
    timeoutOverride: { productionTimeoutMs: 15_000, testTimeoutMs: TEST_TIMEOUT_MS, testOnly: true, sourceFilesModified: false },
    calls: { successes, attempts, cumulativeCostCny, feeCap: null, records: callEvidence },
    outputs: Object.fromEntries(VARIANTS.map((variant) => [variant, { path: outputs[variant], bytes: structures[variant].bytes, sha256: structures[variant].sha256 }])),
    blueprintPageIds: pageIds,
    comparisonRows,
    uniqueness,
    cacheOrAssetMappingFailures: cacheFailures,
    structurePass,
    structures,
  };
  fs.writeFileSync(path.join(RUN_DIR, "ab-structure-evidence.json"), JSON.stringify(evidence, null, 2), "utf8");

  if (!structurePass) throw new Error("STRUCTURE_OR_ASSET_HARD_GATE_FAILED");
  if (blockedNetworkRequests !== 0) throw new Error(`BLOCKED_NETWORK_REQUESTS:${blockedNetworkRequests}`);
  if (deepseekNetworkRequests !== attempts) throw new Error(`NETWORK_ATTEMPT_MISMATCH:${deepseekNetworkRequests}/${attempts}`);

  // Exact ticket paths are materialized only after every structure/cache gate passes.
  for (const variant of VARIANTS) {
    const fixed = path.join(BASE_OUT, path.basename(outputs[variant]));
    fs.copyFileSync(outputs[variant], fixed, fs.constants.COPYFILE_EXCL);
  }
  fs.writeFileSync(path.join(BASE_OUT, "latest-run.json"), JSON.stringify({ runId, runDirectory: RUN_DIR, evidence: path.join(RUN_DIR, "ab-structure-evidence.json") }, null, 2), { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ ok: true, runId, runDirectory: RUN_DIR, successes, attempts, cumulativeCostCny, deepseekNetworkRequests, blockedNetworkRequests, structurePass }, null, 2));
}

void main().catch((error) => {
  activeCall = null;
  const message = error instanceof Error ? error.message : String(error);
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUN_DIR, "fatal.json"), JSON.stringify({ runId, error: message, attempts: deepseekNetworkRequests, cumulativeCostCny, blockedNetworkRequests, blockedNetworkEvidence, supabaseStubEvidence, callEvidence }, null, 2), "utf8");
  console.error(JSON.stringify({ ok: false, runId, runDirectory: RUN_DIR, error: message, attempts: deepseekNetworkRequests, cumulativeCostCny, blockedNetworkRequests }, null, 2));
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
  PptxGenJS.prototype.addSlide = originalAddSlide;
});
