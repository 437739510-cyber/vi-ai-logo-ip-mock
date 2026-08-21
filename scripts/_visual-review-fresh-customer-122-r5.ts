import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());
const BASE = path.join(ROOT, "logs", "122-r5");
const ASSETS = path.join(BASE, "assets");
const CANDIDATES = path.join(ASSETS, "candidates");
const SENSENOVA_URL = "https://token.sensenova.cn/v1/chat/completions";
const AGNES_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const AGNES_MODEL = "agnes-2.5-flash";
const SOFFICE = "C:/Program Files/LibreOffice/program/soffice.exe";
const PDFTOPPM = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe";
const R8_ROOT = path.join(ROOT, "logs", "122-r8");
const R7_ROOT = path.join(ROOT, "logs", "122-r7");
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");

const roles = [
  { role: "scene.storefront", expected: "太原社区沿街单店洗车场外景，空白门头，非豪华连锁" },
  { role: "scene.wash_bay", expected: "明亮整洁的标准洗车工位" },
  { role: "scene.interior_detail", expected: "汽车内饰深度清洁" },
  { role: "scene.handover", expected: "完工交车与共同验车，无人物特写" },
  { role: "scene.loyalty_materials", expected: "钥匙牌、毛巾、空白会员卡等老客维护物料" },
] as const;

// R7（TICKET-122-R7）：已聚焦裁剪实锤污染的候选一律不参与选择（R6 伪 PASS 教训）。
// storefront 1/2/3 与 wash_bay 1/2/3 均被双通道指认卡通公仔/玩偶/品牌车标，
// 即使单图门偶发通过也不得回退选中。
const DISABLED_CANDIDATES: Record<string, number[]> = {
  "scene.storefront": [1, 2, 3],
  "scene.wash_bay": [1, 2, 3, 4, 5],
};

function parseJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("VISUAL_JSON_NOT_FOUND");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function local(prompt: string, images: Buffer[], context: string) {
  let last = "";
  let rawSample = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "qwen2.5vl:latest", prompt, images: images.map((item) => item.toString("base64")), stream: false, keep_alive: "5m", options: { temperature: 0, num_predict: 2200 } }), signal: AbortSignal.timeout(240_000) });
      const body = await response.json() as any;
      if (!response.ok) throw new Error(`OLLAMA_HTTP_${response.status}`);
      const raw = String(body.response || "");
      rawSample = raw.slice(0, 300);
      return { raw, parsed: parseJson(raw), attempts: attempt };
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
  }
  throw new Error(`LOCAL_VISUAL_FAILED:${context}:${last}:raw=${rawSample}`);
}

async function online(prompt: string, images: Buffer[], context: string) {
  const key = process.env.SENSENOVA_API_KEY;
  if (!key) throw new Error("SENSENOVA_API_KEY_NOT_CONFIGURED");
  let last = "";
  let rawSample = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const content: any[] = [];
      for (const image of images) {
        const jpeg = await sharp(image).jpeg({ quality: 94 }).toBuffer();
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } });
      }
      content.push({ type: "text", text: prompt });
      const response = await fetch(SENSENOVA_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "sensenova-6.7-flash-lite", messages: [{ role: "user", content }], max_tokens: 8192, temperature: 0 }), signal: AbortSignal.timeout(240_000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`SENSENOVA_HTTP_${response.status}:${sha256(text)}`);
      const body = JSON.parse(text);
      const raw = String(body.choices?.[0]?.message?.content || "");
      rawSample = raw.slice(0, 300);
      return { raw, parsed: parseJson(raw), attempts: attempt, httpStatus: response.status };
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
  }
  throw new Error(`ONLINE_VISUAL_FAILED:${context}:${last}:raw=${rawSample}`);
}

// TICKET-122-R8：Agnes 免费线上视觉通道（OpenAI 兼容，推理型模型给足 max_tokens）。
async function onlineAgnes(prompt: string, images: Buffer[], context: string) {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new Error("AGNES_API_KEY_NOT_CONFIGURED");
  let last = "";
  let rawSample = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const content: any[] = [];
      for (const image of images) {
        const jpeg = await sharp(image).jpeg({ quality: 94 }).toBuffer();
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } });
      }
      content.push({ type: "text", text: prompt });
      const response = await fetch(AGNES_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: AGNES_MODEL, messages: [{ role: "user", content }], max_tokens: 8192, temperature: 0 }), signal: AbortSignal.timeout(240_000) });
      const text = await response.text();
      if (response.status === 429) {
        last = "AGNES_429";
        await new Promise((resolve) => setTimeout(resolve, 2_500 * attempt));
        continue;
      }
      if (!response.ok) throw new Error(`AGNES_HTTP_${response.status}:${sha256(text)}`);
      const body = JSON.parse(text);
      const raw = String(body.choices?.[0]?.message?.content || "");
      rawSample = raw.slice(0, 300);
      return { raw, parsed: parseJson(raw), attempts: attempt, httpStatus: response.status };
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
  }
  throw new Error(`AGNES_VISUAL_FAILED:${context}:${last}:raw=${rawSample}`);
}

function scenePrompt(role: string, expected: string, attempt: number) {
  return `你是独立图片质检员。只检查这1张全新测试资产，不得猜测项目历史。语义角色=${role}，期望=${expected}。品牌应为太原社区洗车语境，深青绿/清水蓝绿、暖白、石墨灰，写实商业摄影，清爽踏实，不能像豪华连锁。逐项判断：sceneCorrect场景语义正确；noTextOrGarbled没有任何可识别文字、乱码、字母、数字或水印（车牌也应空白/不可读）；noOtherBrand没有其他品牌/商标；paletteFit色彩语境适合；photorealistic写实非卡通；noCrossProject没有百疗萃、萃瑶、JIK0、招财进堡、公仔或其他客户痕迹；noForbidden没有皇冠盾牌翅膀火焰红金土豪风；noCloseupPerson无人物特写；usable可用于VI手册。只输出严格JSON：{"role":"${role}","attempt":${attempt},"sceneCorrect":true,"noTextOrGarbled":true,"noOtherBrand":true,"paletteFit":true,"photorealistic":true,"noCrossProject":true,"noForbidden":true,"noCloseupPerson":true,"usable":true,"notes":""}`;
}

function validScene(result: any, role: string, attempt: number) {
  const keys = ["sceneCorrect", "noTextOrGarbled", "noOtherBrand", "paletteFit", "photorealistic", "noCrossProject", "noForbidden", "noCloseupPerson", "usable"];
  return result?.role === role && Number(result?.attempt) === attempt && keys.every((key) => result?.[key] === true);
}

async function assetsMode() {
  const candidateReviews: any[] = [];
  const selected: any[] = [];
  const failedRoles: string[] = [];
  for (const item of roles) {
    const files = (await fs.readdir(CANDIDATES)).filter((name) => name.startsWith(`${item.role}-attempt-`) && name.endsWith(".png")).sort();
    let chosen: any = null;
    for (const name of files) {
      const attempt = Number(name.match(/attempt-(\d+)/)?.[1]);
      if (DISABLED_CANDIDATES[item.role]?.includes(attempt)) {
        console.log(JSON.stringify({ role: item.role, attempt, skipped: true, reason: "disabled-contaminated-candidate" }));
        continue;
      }
      const file = path.join(CANDIDATES, name);
      const bytes = await fs.readFile(file);
      const prompt = scenePrompt(item.role, item.expected, attempt);
      const localResult = await local(prompt, [bytes], `${item.role}/attempt-${attempt}`);
      const onlineResult = await online(prompt, [bytes], `${item.role}/attempt-${attempt}`);
      const pass = validScene(localResult.parsed, item.role, attempt) && validScene(onlineResult.parsed, item.role, attempt);
      console.log(JSON.stringify({ role: item.role, attempt, pass, localParsed: !!localResult.parsed, onlineParsed: !!onlineResult.parsed }));
      const record = { role: item.role, expected: item.expected, attempt, path: file, bytes: bytes.length, sha256: sha256(bytes), local: localResult, online: onlineResult, pass };
      candidateReviews.push(record);
      if (pass) chosen = record;
    }
    if (chosen) selected.push(chosen);
    else failedRoles.push(item.role);
  }

  const logoFiles = ["logo-primary-transparent.png", "logo-on-dark.png", "logo-on-light.png"].map((name) => path.join(ASSETS, name));
  const logoPrompt = `你将看到同一Logo的两个版本（透明底/深色底/浅色底组合）。检查：中文必须准确为“清丽洗车”四字且清晰现代黑体；图形包含水滴负形与简洁车身轮廓；不存在皇冠、盾牌、翅膀、火焰、红金土豪风、卡通公仔、其他品牌、乱码或水印；两版本结构一致并适合门头/工服/毛巾/会员卡/钥匙牌/社交头像。只输出严格JSON：{"textExact":true,"waterdrop":true,"carOutline":true,"structureConsistent":true,"noForbidden":true,"noOtherBrand":true,"legible":true,"usable":true,"notes":""}`;
  const logoPairs = [
    { label: "transparent-dark", files: [logoFiles[0], logoFiles[1]] },
    { label: "dark-light", files: [logoFiles[1], logoFiles[2]] },
    { label: "transparent-light", files: [logoFiles[0], logoFiles[2]] },
  ];
  const logoKeys = ["textExact", "waterdrop", "carOutline", "structureConsistent", "noForbidden", "noOtherBrand", "legible", "usable"];
  const logoPairsReview: any[] = [];
  for (const pair of logoPairs) {
    const pairBuffers = await Promise.all(pair.files.map((file) => fs.readFile(file)));
    const pairLocal = await local(logoPrompt, pairBuffers, `logo/${pair.label}`);
    const pairOnline = await online(logoPrompt, pairBuffers, `logo/${pair.label}`);
    const pairPass = logoKeys.every((key) => pairLocal.parsed?.[key] === true && pairOnline.parsed?.[key] === true);
    logoPairsReview.push({ label: pair.label, local: pairLocal, online: pairOnline, pass: pairPass });
    console.log(JSON.stringify({ role: "logo", pair: pair.label, pass: pairPass, localParsed: !!pairLocal.parsed, onlineParsed: !!pairOnline.parsed }));
  }
  const logoPass = logoPairsReview.every((item) => item.pass);

  let consistency: any = null;
  let consistencyPass = false;
  if (failedRoles.length === 0) {
    const consistencyPrompt = `你将看到同一品牌VI的两个场景（共5类：社区门店外景、洗车工位、内饰深清、共同验车、老客会员物料，这里为其中相邻两类）。检查两张是否都是写实中国社区洗车语境，深青绿/清水蓝绿视觉一致，无跨客户图文、无其他品牌、无AI乱码/文字/水印、无豪华连锁夸张感、无公仔、无人物特写，并且语义彼此匹配属于同一套VI。只输出严格JSON：{"styleConsistent":true,"paletteConsistent":true,"noTextOrGarbled":true,"noOtherBrand":true,"noCrossProject":true,"noCloseupPerson":true,"usableAsSet":true,"notes":""}`;
    const pairOrder: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4]];
    const consistencyPairs: any[] = [];
    const keys = ["styleConsistent", "paletteConsistent", "noTextOrGarbled", "noOtherBrand", "noCrossProject", "noCloseupPerson", "usableAsSet"];
    for (const [a, b] of pairOrder) {
      const buffers = await Promise.all([selected[a].path, selected[b].path].map((file) => fs.readFile(file)));
      const pairLocal = await local(consistencyPrompt, buffers, `consistency/${a}-${b}`);
      const pairOnline = await online(consistencyPrompt, buffers, `consistency/${a}-${b}`);
      const pairPass = keys.every((key) => pairLocal.parsed?.[key] === true && pairOnline.parsed?.[key] === true);
      consistencyPairs.push({ pair: `${selected[a].role}+${selected[b].role}`, local: pairLocal, online: pairOnline, pass: pairPass });
      console.log(JSON.stringify({ role: "consistency", pair: `${selected[a].role}+${selected[b].role}`, pass: pairPass, localParsed: !!pairLocal.parsed, onlineParsed: !!pairOnline.parsed }));
    }
    consistencyPass = consistencyPairs.every((item) => item.pass);
    consistency = { pairs: consistencyPairs, pass: consistencyPass };
  }

  const pass = failedRoles.length === 0 && logoPass && consistencyPass;
  const logoManifest = [];
  for (const file of logoFiles) {
    const bytes = await fs.readFile(file); const meta = await sharp(bytes).metadata();
    logoManifest.push({ semanticRole: path.basename(file).includes("primary") ? "logo.primary.transparent" : path.basename(file).includes("dark") ? "logo.application.dark" : "logo.application.light", path: file, mime: "image/png", bytes: bytes.length, width: meta.width, height: meta.height, sha256: sha256(bytes) });
  }
  const sceneManifest = [];
  if (pass) {
    for (const item of selected) {
      const destination = path.join(ASSETS, `${item.role}.png`);
      await fs.copyFile(item.path, destination);
      const bytes = await fs.readFile(destination); const meta = await sharp(bytes).metadata();
      sceneManifest.push({ semanticRole: item.role, key: roles.find((role) => role.role === item.role)?.role === item.role ? (roles as any).find((role: any) => role.role === item.role)?.role : item.role, renderKey: ({ "scene.storefront": "marketing-storefront", "scene.wash_bay": "packaging-1", "scene.interior_detail": "packaging-2", "scene.handover": "marketing-1", "scene.loyalty_materials": "stationery-1" } as any)[item.role], sourceCandidate: item.path, selectedAttempt: item.attempt, path: destination, mime: "image/png", bytes: bytes.length, width: meta.width, height: meta.height, sha256: sha256(bytes) });
    }
    await fs.writeFile(path.join(BASE, "asset-manifest.json"), JSON.stringify({ ticket: "TICKET-122-R5", frozenAt: new Date().toISOString(), logo: logoManifest, scenes: sceneManifest, allFourRoundsUseSameSourceBytes: true, sourceAssetCount: logoManifest.length + sceneManifest.length, imagesDisplayedInCodex: false }, null, 2));
  }
  const output = { ticket: "TICKET-122-R5", phase: 1, generatedAt: new Date().toISOString(), pass, failedRoles, logo: { files: logoFiles, pairs: logoPairsReview, pass: logoPass }, candidates: candidateReviews, selected: selected.map(({ local: _local, online: _online, ...item }) => item), consistency, channelsIndependent: true, localChannel: "qwen2.5vl:latest", onlineChannel: "sensenova-6.7-flash-lite", onlineVerifiedFree: true, externalVisualCostCny: 0, imagesDisplayedInCodex: false, credentialValuesRecorded: false };
  const outPath = path.join(BASE, "asset-visual-review.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ pass, output: outPath, failedRoles, logoPass, consistencyPass, selected: output.selected }, null, 2));
  if (!pass) process.exitCode = 2;
}

// ===== Phase 4（TICKET-122-R8）：整本双视觉盲评 W/X/Y/Z =====
const METRICS = ["hierarchy", "whitespace", "alignment", "brandFeel", "readability", "occlusion", "redundancy", "personalization"] as const;

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function reviewPrompt(label: string, pageIndex: number, totalPages: number): string {
  return `你是独立的品牌VI手册视觉评审员。这是盲评版本 ${label} 的第 ${pageIndex}/${totalPages} 页。不要猜测生成方式，不要引用其他模型意见。请对以下8项按1-10分评分（可用一位小数）：hierarchy信息层级、whitespace留白与呼吸感、alignment对齐与网格、brandFeel品牌感、readability可读性、occlusion遮挡与越界（10=无问题）、redundancy重复与冗余（10=无问题）、personalization个性化程度。另写最明显优点 advantage、最明显缺点 disadvantage、阻断问题 blockers（无则空数组）。只输出严格JSON，不要markdown：{"label":"${label}","pageIndex":${pageIndex},"scores":{"hierarchy":0,"whitespace":0,"alignment":0,"brandFeel":0,"readability":0,"occlusion":0,"redundancy":0,"personalization":0},"advantage":"","disadvantage":"","blockers":[]}`;
}

function validateReview(parsed: any, label: string, pageIndex: number): any {
  if (parsed?.label !== label || Number(parsed?.pageIndex) !== pageIndex) throw new Error(`VISUAL_LABEL_OR_PAGE_INVALID:${label}/${pageIndex}`);
  for (const metric of METRICS) {
    const value = Number(parsed?.scores?.[metric]);
    if (!Number.isFinite(value) || value < 1 || value > 10) throw new Error(`VISUAL_SCORE_INVALID:${label}/${pageIndex}/${metric}`);
    parsed.scores[metric] = value;
  }
  parsed.blockers = Array.isArray(parsed.blockers) ? parsed.blockers.map(String) : [];
  parsed.advantage = String(parsed.advantage || "");
  parsed.disadvantage = String(parsed.disadvantage || "");
  return parsed;
}

async function renderDeckToPng(pptxPath: string, outDir: string): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  execFileSync(SOFFICE, ["--headless", "--convert-to", "pdf", "--outdir", outDir, pptxPath], { stdio: "pipe" });
  const pdf = path.join(outDir, "manual.pdf");
  if (!(await fs.access(pdf).then(() => true).catch(() => false))) throw new Error(`PDF missing: ${pdf}`);
  execFileSync(PDFTOPPM, ["-png", "-r", "100", pdf, path.join(outDir, "page")], { stdio: "pipe" });
  const files = (await fs.readdir(outDir)).filter((f) => /^page-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (files.length === 0) throw new Error(`No pages rendered for ${pptxPath}`);
  return files.map((f) => path.join(outDir, f));
}

type ChannelFn = (prompt: string, images: Buffer[], context: string) => Promise<{ raw: string; parsed: any; attempts: number }>;

async function reviewPage(label: string, pageIndex: number, totalPages: number, pngPath: string, channelA: ChannelFn, channelB: ChannelFn) {
  const bytes = await fs.readFile(pngPath);
  const prompt = reviewPrompt(label, pageIndex, totalPages);
  const runChannel = async (fn: ChannelFn) => {
    let lastError = "";
    let lastRaw = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await fn(prompt, [bytes], `${label}/p${pageIndex}`);
        lastRaw = result.raw || "";
        return { parsed: validateReview(result.parsed, label, pageIndex), attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    return { parsed: null, error: lastError, rawSample: lastRaw.slice(0, 300), attempts: 3 };
  };
  // 两个线上通道互相独立，并行调用减半总时长（不涉及本地 GPU 争用）
  const [aResult, bResult] = await Promise.all([runChannel(channelA), runChannel(channelB)]);
  return { label, pageIndex, pngPath, pngSha256: sha256(bytes), a: aResult.parsed, b: bResult.parsed, aError: aResult.error || null, bError: bResult.error || null };
}

async function manualMode() {
  await fs.mkdir(R8_ROOT, { recursive: true });
  const dualOnline = process.argv.includes("--channels=dual-online");
  const channelA: ChannelFn = dualOnline ? online : local;
  const channelB: ChannelFn = dualOnline ? onlineAgnes : online;
  const channelNames = dualOnline ? ["sensenova-6.7-flash-lite", "agnes-2.5-flash"] : ["qwen2.5vl:latest", "sensenova-6.7-flash-lite"];
  const latest = JSON.parse(await fs.readFile(path.join(R7_ROOT, "latest-run.json"), "utf8"));
  const variants: Array<"A1" | "A2" | "B1" | "B2"> = ["A1", "A2", "B1", "B2"];
  const blindOrder = shuffled(variants);
  const labels = ["W", "X", "Y", "Z"] as const;
  const mapping: Record<string, string> = {};
  const renderDirs: Record<string, string> = {};
  for (let i = 0; i < 4; i += 1) {
    const variant = blindOrder[i];
    const projectId = latest.projectIds.find((id: string) => id.includes(`-${variant}-`))!;
    mapping[labels[i]] = `${variant} (${projectId})`;
    renderDirs[labels[i]] = path.join(R8_ROOT, "phase4", `render-${labels[i]}`);
  }
  const blindMapFile = path.join(R8_ROOT, "phase4", "blind-map.json");
  await fs.mkdir(path.dirname(blindMapFile), { recursive: true });
  const existingMap = await fs.readFile(blindMapFile, "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (existingMap?.mapping && Object.keys(existingMap.mapping).length === 4) {
    for (const label of labels) mapping[label] = existingMap.mapping[label];
  }
  await fs.writeFile(blindMapFile, JSON.stringify({ mapping, generatedAt: new Date().toISOString(), revealed: false }, null, 2));

  const reviews: any[] = [];
  const reviewsFile = path.join(R8_ROOT, "phase4", "reviews.jsonl");
  const doneKeys = new Set<string>();
  try {
    const lines = (await fs.readFile(reviewsFile, "utf8")).split("\n").filter(Boolean);
    for (const line of lines) {
      const r = JSON.parse(line);
      reviews.push(r);
      doneKeys.add(`${r.label}:${r.pageIndex}`);
    }
  } catch { /* 首次运行无历史 */ }
  const control: any[] = [];
  let totalPages = 0;
  for (const label of labels) {
    const projectId = mapping[label].split(" (")[1].slice(0, -1);
    const pptxPath = path.join(latest.dir, projectId, "manual.pptx");
    const pages = await renderDeckToPng(pptxPath, renderDirs[label]);
    totalPages = pages.length;
    console.log(JSON.stringify({ label, pages: pages.length, renderDir: renderDirs[label] }));
    for (let i = 0; i < pages.length; i += 1) {
      if (doneKeys.has(`${label}:${i + 1}`)) {
        console.log(JSON.stringify({ label, page: i + 1, resumed: true }));
        continue;
      }
      const review = await reviewPage(label, i + 1, pages.length, pages[i], channelA, channelB);
      reviews.push(review);
      await fs.appendFile(reviewsFile, JSON.stringify(review) + "\n", "utf8");
      console.log(JSON.stringify({ label, page: i + 1, done: true }));
    }
  }
  // 控制页采样波动：W 第 1 页双通道各再评一次
  const wPage1 = renderDirs.W ? (await fs.readdir(renderDirs.W)).filter((f) => /^page-\d+\.png$/.test(f)).sort()[0] : "";
  if (wPage1) {
    const bytes = await fs.readFile(path.join(renderDirs.W, wPage1));
    const prompt = reviewPrompt("W", 1, totalPages);
    const a2 = await channelA(prompt, [bytes], "control/a-2");
    const b2 = await channelB(prompt, [bytes], "control/b-2");
    try {
      control.push({ page: "W-1", aSecond: validateReview(a2.parsed, "W", 1), bSecond: validateReview(b2.parsed, "W", 1) });
    } catch (e) {
      control.push({ page: "W-1", error: e instanceof Error ? e.message : String(e) });
    }
  }

  const byVariant: Record<string, { count: number; totals: Record<string, number>; pages: any[] }> = {};
  for (const label of labels) {
    const variant = mapping[label].split(" (")[0];
    byVariant[variant] = { count: 0, totals: Object.fromEntries(METRICS.map((m) => [m, 0])), pages: [] };
  }
  const divergences: any[] = [];
  for (const r of reviews) {
    if (!r.a || !r.b) {
      divergences.push({ label: r.label, pageIndex: r.pageIndex, partial: true, aError: r.aError, bError: r.bError });
      continue;
    }
    const variant = mapping[r.label].split(" (")[0];
    const agg = byVariant[variant];
    agg.count += 1;
    for (const m of METRICS) {
      const ls = Number(r.a.scores[m]);
      const os = Number(r.b.scores[m]);
      agg.totals[m] += (ls + os) / 2;
      if (Math.abs(ls - os) > 2) divergences.push({ label: r.label, pageIndex: r.pageIndex, metric: m, local: ls, online: os });
    }
    agg.pages.push({ pageIndex: r.pageIndex, a: r.a, b: r.b });
  }
  const averages: Record<string, Record<string, number>> = {};
  for (const [variant, agg] of Object.entries(byVariant)) {
    averages[variant] = Object.fromEntries(METRICS.map((m) => [m, Number((agg.totals[m] / Math.max(agg.count, 1)).toFixed(2))]));
  }
  const aAvg = Object.fromEntries(METRICS.map((m) => [m, Number(((averages.A1?.[m] || 0) + (averages.A2?.[m] || 0)) / 2).toFixed(2)]));
  const bAvg = Object.fromEntries(METRICS.map((m) => [m, Number(((averages.B1?.[m] || 0) + (averages.B2?.[m] || 0)) / 2).toFixed(2)]));
  const outcome = METRICS.map((m) => ({ metric: m, a: Number(aAvg[m]), b: Number(bAvg[m]), diff: Number((Number(bAvg[m]) - Number(aAvg[m])).toFixed(2)) }));
  const bNotLower = outcome.every((o) => o.diff >= -0.5);
  const conclusion = bNotLower ? "B 视觉总体不低于 A（可接受）" : "B 存在关键页/指标明显低于 A（需说明）";

  const result = {
    ticket: "TICKET-122-R8", phase: 4, generatedAt: new Date().toISOString(),
    runId: latest.runId, totalPages, reviewCount: reviews.length,
    mapping, averages, aAvg, bAvg, outcome, conclusion, bNotLower,
    divergenceCount: divergences.length, divergences: divergences.slice(0, 200),
    control, channelsIndependent: true, channels: channelNames,
    allOnline: dualOnline, onlineVerifiedFree: true, externalVisualCostCny: 0, imagesDisplayedInCodex: false, credentialValuesRecorded: false,
  };
  const outPath = path.join(R8_ROOT, "phase4", "visual-review.json");
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(R8_ROOT, "phase4", "visual-review.md"), `# Phase 4 整本双视觉盲评\n\n${JSON.stringify(result, null, 2)}`);
  await fs.writeFile(blindMapFile, JSON.stringify({ mapping, generatedAt: new Date().toISOString(), revealed: true }, null, 2));
  console.log(JSON.stringify({ ok: true, phase: 4, totalPages, reviewCount: reviews.length, mapping, averages, aAvg, bAvg, conclusion, divergenceCount: divergences.length, output: outPath }, null, 2));
  if (!bNotLower) process.exitCode = 2;
}

async function main() {
  if (process.argv.includes("--assets")) return assetsMode();
  if (process.argv.includes("--manual")) return manualMode();
  throw new Error("Use --assets (Phase 1) or --manual (Phase 4 blind review)");
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), imagesDisplayedInCodex: false }, null, 2));
  process.exitCode = 1;
});
