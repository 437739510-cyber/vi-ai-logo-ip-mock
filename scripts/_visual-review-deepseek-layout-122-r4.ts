/** TICKET-122-R4 Phase 3: text-only blind visual review; never displays images. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = "D:/disk/HermesDisk/bb-clean";
const BASE = path.join(ROOT, "logs/122-r4");
const latest = JSON.parse(fs.readFileSync(path.join(BASE, "latest-run.json"), "utf8"));
const RUN_DIR = latest.runDirectory as string;
const OUT = path.join(RUN_DIR, "visual-review.json");
const PAGE_FILES = [
  { pageId: "cover", slide: 1 },
  { pageId: "logo-interpretation", slide: 4 },
  { pageId: "summary", slide: 20 },
] as const;
const METRICS = ["hierarchy", "whitespace", "alignment", "brandFeel", "readability", "occlusion", "redundancy", "personalization"] as const;
const SENSENOVA_URL = "https://token.sensenova.cn/v1/chat/completions";

type Variant = "A1" | "A2" | "B";
type BlindLabel = "X" | "Y" | "Z";

function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function imagePath(variant: Variant, slide: number): string {
  const dir = variant === "B" ? "manual-B-deterministic-layout" : `manual-${variant}-real-ai-layout`;
  return path.join(RUN_DIR, dir, `slide-${slide}.png`);
}

function prompt(label: BlindLabel): string {
  return `你是独立的品牌VI手册视觉评审员。你将按顺序看到盲评版本 ${label} 的3张页面：第1张=封面，第2张=标识诠释，第3张=总结页。不要猜测生成方式，不要引用其他模型意见。请对每页以下8项按1-10分评分（可用一位小数）：hierarchy信息层级、whitespace留白与呼吸感、alignment对齐与网格、brandFeel品牌感、readability可读性、occlusion遮挡与越界（10=无问题）、redundancy重复与冗余（10=无问题）、personalization个性化程度。每页另写最明显优点 advantage、最明显缺点 disadvantage、阻断问题 blockers（无则空数组）。只输出严格JSON，不要markdown：{"label":"${label}","pages":{"cover":{"scores":{"hierarchy":0,"whitespace":0,"alignment":0,"brandFeel":0,"readability":0,"occlusion":0,"redundancy":0,"personalization":0},"advantage":"","disadvantage":"","blockers":[]},"logo-interpretation":{...},"summary":{...}},"overall":""}`;
}

function parseJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("VISUAL_JSON_NOT_FOUND");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateReview(parsed: any, label: BlindLabel): any {
  if (parsed?.label !== label || !parsed?.pages) throw new Error(`VISUAL_LABEL_OR_PAGES_INVALID:${label}`);
  for (const { pageId } of PAGE_FILES) {
    const page = parsed.pages[pageId];
    if (!page?.scores) throw new Error(`VISUAL_PAGE_MISSING:${label}/${pageId}`);
    for (const metric of METRICS) {
      const value = Number(page.scores[metric]);
      if (!Number.isFinite(value) || value < 1 || value > 10) throw new Error(`VISUAL_SCORE_INVALID:${label}/${pageId}/${metric}`);
      page.scores[metric] = value;
    }
    page.total = METRICS.reduce((sum, metric) => sum + page.scores[metric], 0) / METRICS.length;
    page.blockers = Array.isArray(page.blockers) ? page.blockers.map(String) : [];
    page.advantage = String(page.advantage || "");
    page.disadvantage = String(page.disadvantage || "");
  }
  parsed.overall = String(parsed.overall || "");
  return parsed;
}

async function localReview(label: BlindLabel, buffers: Buffer[]): Promise<{ raw: string; parsed: any; attempts: number }> {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "qwen2.5vl:latest", prompt: prompt(label), images: buffers.map((item) => item.toString("base64")), stream: false, keep_alive: "5m", options: { temperature: 0, num_predict: 2200 } }),
        signal: AbortSignal.timeout(240_000),
      });
      const body = await response.json() as any;
      if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);
      const raw = String(body.response || "");
      return { raw, parsed: validateReview(parseJson(raw), label), attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`LOCAL_VISUAL_FAILED:${label}:${lastError}`);
}

async function onlineReview(label: BlindLabel, buffers: Buffer[]): Promise<{ raw: string; parsed: any; attempts: number; httpStatus: number }> {
  const key = process.env.SENSENOVA_API_KEY;
  if (!key) throw new Error("SENSENOVA_API_KEY_NOT_CONFIGURED");
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const content: any[] = buffers.map((item) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${item.toString("base64")}` } }));
      content.push({ type: "text", text: prompt(label) });
      const response = await fetch(SENSENOVA_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sensenova-6.7-flash-lite", messages: [{ role: "user", content }], max_tokens: 4096, temperature: 0 }),
        signal: AbortSignal.timeout(240_000),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`SENSENOVA_HTTP_${response.status}:${sha256(responseText)}`);
      const body = JSON.parse(responseText);
      const raw = String(body.choices?.[0]?.message?.content || "");
      return { raw, parsed: validateReview(parseJson(raw), label), attempts: attempt, httpStatus: response.status };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`ONLINE_VISUAL_FAILED:${label}:${lastError}`);
}

function variantAverages(channel: Record<BlindLabel, any>, reveal: Record<BlindLabel, Variant>): Record<Variant, any> {
  const result: any = {};
  for (const label of ["X", "Y", "Z"] as BlindLabel[]) {
    const variant = reveal[label];
    const pages = channel[label].parsed.pages;
    result[variant] = {
      pageTotals: Object.fromEntries(PAGE_FILES.map(({ pageId }) => [pageId, pages[pageId].total])),
      overall: PAGE_FILES.reduce((sum, { pageId }) => sum + pages[pageId].total, 0) / PAGE_FILES.length,
      metricAverages: Object.fromEntries(METRICS.map((metric) => [metric, PAGE_FILES.reduce((sum, { pageId }) => sum + pages[pageId].scores[metric], 0) / PAGE_FILES.length])),
      blockers: PAGE_FILES.flatMap(({ pageId }) => pages[pageId].blockers.map((item: string) => `${pageId}:${item}`)),
    };
  }
  return result;
}

function classify(local: Record<Variant, any>, online: Record<Variant, any>): any {
  const channels = { local, online };
  const channelRows: any[] = [];
  let noDegrade = true;
  let acceptable = true;
  let fail = false;
  for (const [name, scores] of Object.entries(channels) as any) {
    const aiMean = (scores.A1.overall + scores.A2.overall) / 2;
    const bDrop = aiMean - scores.B.overall;
    const singleWorstDrop = Math.max(scores.A1.overall - scores.B.overall, scores.A2.overall - scores.B.overall);
    const criticalDrops = ["hierarchy", "readability", "occlusion"].map((metric) => ((scores.A1.metricAverages[metric] + scores.A2.metricAverages[metric]) / 2) - scores.B.metricAverages[metric]);
    const blockers = scores.A1.blockers.length + scores.A2.blockers.length + scores.B.blockers.length;
    channelRows.push({ channel: name, aiMean, b: scores.B.overall, bDrop, singleWorstDrop, criticalDrops, blockers });
    if (!(bDrop <= 0.3 && singleWorstDrop <= 0.7 && criticalDrops.every((value) => value <= 0.5) && blockers === 0)) noDegrade = false;
    if (!(bDrop <= 1.0 && blockers === 0)) acceptable = false;
    if (bDrop > 1.0 || criticalDrops.some((value) => value > 0.5) || blockers > 0) fail = true;
  }
  const pageChannelDiffs = (Object.keys(local) as Variant[]).flatMap((variant) => PAGE_FILES.map(({ pageId }) => ({ variant, pageId, diff: Math.abs(local[variant].pageTotals[pageId] - online[variant].pageTotals[pageId]) })));
  const aWaves = Object.entries(channels).map(([channel, scores]: any) => ({ channel, difference: Math.abs(scores.A1.overall - scores.A2.overall) }));
  const disputed = pageChannelDiffs.some((item) => item.diff > 2.0) || aWaves.some((item) => item.difference > 1.5);
  const tier = disputed ? "DISPUTED" : noDegrade ? "不降质" : fail ? "不建议部署" : acceptable ? "可接受轻微损失" : "不建议部署";
  return { tier, channelRows, pageChannelDiffs, a1A2Waves: aWaves };
}

async function main(): Promise<void> {
  if (fs.existsSync(OUT)) throw new Error(`VISUAL_OUTPUT_EXISTS:${OUT}`);
  const variants = shuffled<Variant>(["A1", "A2", "B"]);
  const reveal: Record<BlindLabel, Variant> = { X: variants[0], Y: variants[1], Z: variants[2] };
  const labels = ["X", "Y", "Z"] as BlindLabel[];
  const imageEvidence: any[] = [];
  const local: any = {};
  const online: any = {};

  for (const label of labels) {
    const variant = reveal[label];
    const pngBuffers = PAGE_FILES.map(({ pageId, slide }) => {
      const file = imagePath(variant, slide);
      const buffer = fs.readFileSync(file);
      imageEvidence.push({ label, pageId, slide, sourcePath: file, pngBytes: buffer.length, pngSha256: sha256(buffer) });
      return buffer;
    });
    local[label] = await localReview(label, pngBuffers);
  }

  for (const label of labels) {
    const variant = reveal[label];
    const jpegBuffers = [];
    for (const { slide } of PAGE_FILES) jpegBuffers.push(await sharp(fs.readFileSync(imagePath(variant, slide))).jpeg({ quality: 95 }).toBuffer());
    online[label] = await onlineReview(label, jpegBuffers);
  }

  const localByVariant = variantAverages(local, reveal);
  const onlineByVariant = variantAverages(online, reveal);
  const classification = classify(localByVariant, onlineByVariant);
  const samePixelByPage = PAGE_FILES.map(({ pageId, slide }) => {
    const hashes = (Object.keys(reveal) as BlindLabel[]).map((label) => imageEvidence.find((item) => item.label === label && item.pageId === pageId).pngSha256);
    return { pageId, slide, hashesByBlindLabel: Object.fromEntries(labels.map((label, index) => [label, hashes[index]])), identical: new Set(hashes).size === 1 };
  });

  const output = {
    ticket: "TICKET-122-R4",
    phase: 3,
    generatedAt: new Date().toISOString(),
    blindExecutionOrder: labels,
    channelsIndependent: true,
    localChannel: { name: "Ollama qwen2.5vl:latest", externalCostCny: 0, reviews: local },
    onlineChannel: { name: "SenseNova sensenova-6.7-flash-lite", endpoint: SENSENOVA_URL, verifiedFree: true, externalCostCny: 0, reviews: online },
    revealMapping: reveal,
    imageEvidence,
    samePixelByPage,
    localByVariant,
    onlineByVariant,
    classification,
    imagesDisplayedInCodex: false,
    credentialValuesRecorded: false,
  };
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, output: OUT, reveal, samePixelByPage, tier: classification.tier, localCalls: labels.length, onlineCalls: labels.length }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message, output: OUT }, null, 2));
  process.exitCode = 1;
});
