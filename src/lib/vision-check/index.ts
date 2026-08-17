/**
 * 工单 027：生成后自动视觉校验（本地 Ollama，免费）。
 *
 * 流程：3B（qwen2.5vl:3b）快速粗筛逐字提取 → 与期望文本比对；
 * 疑似/不符 → my-vl（7B）终审复核；Ollama 不可用或期望文本缺失时降级为
 * skipped（未初检），绝不静默当作已通过。
 *
 * 注意：本机 Ollama 对 Python urllib 的请求会秒断，统一用 curl.exe 调用。
 */
import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

export type VisionStatus = "passed" | "suspect" | "needs_review" | "skipped";
export type LogoTextMode = "chinese" | "pinyin";

export interface VisionCheckResult {
  status: VisionStatus;
  mode: LogoTextMode;
  expectedText: string;
  coarseModel: string;
  fineModel: string;
  coarseText?: string;
  fineText?: string;
  /** 工单 090：Agnes 免费视觉交叉复核证据（默认关闭，启用后才写入）。 */
  agnesText?: string;
  agnesStatus?: string;
  reason?: string;
  checkedAt?: string;
}

const OLLAMA_API = "http://127.0.0.1:11434";
// 工单 090：Agnes AI 免费视觉通道（OpenAI 兼容网关，key 走环境变量，默认关闭）。
const AGNES_API_BASE = "https://apihub.agnes-ai.com/v1";
const AGNES_MODEL = "agnes-2.5-flash";
const AGNES_MAX_IMAGE_PX = 1280;
const AGNES_TIMEOUT_MS = 60_000;
const AGNES_429_BACKOFF_MS = 2_500;
const OCR_PROMPT =
  "请把图片里面所有可见的汉字、拼音、英文全部逐字完整提取出来，不要总结描述，只输出图片上出现的文字。";
const MASCOT_CHECK_PROMPT =
  '请评估这张3D卡通公仔图的完整性，只输出JSON：{"complete":true或false,"singleSubject":true或false,"whiteBackground":true或false,"noWatermark":true或false,"reason":"一句话"}。检查：1)主体是否完整（无缺肢、畸形、多肢体） 2)是否单主体居中 3)背景是否纯白 4)有无乱码或水印。';
const CLARITY_PROMPT =
  "请判断这张图片是否清晰、无乱码、无水印、无模糊。只回答：清晰 或 有问题。";
const LOGO_FIDELITY_PROMPT =
  '两张图片按顺序分别是：图1原始Logo参考，图2商业场景候选图。只输出JSON：{"logoPresent":true或false,"shapePreserved":true或false,"keyElementsPreserved":true或false,"sceneComplete":true或false,"integrationNatural":true或false,"reason":"一句话"}。必须逐项判断：候选图是否出现Logo、轮廓是否保持、关键图形元素是否保持、是否为完整商业环境而非孤立Logo、Logo透视材质光影是否自然融合。无法确认时填false。';

/** 工单 090：Agnes 通道是否启用（VISION_ENABLE_AGNES=1 且配置了 key）。 */
export function isAgnesVisionEnabled(): boolean {
  return process.env.VISION_ENABLE_AGNES === "1" && Boolean(String(process.env.AGNES_API_KEY || "").trim());
}

/** 缩图到 ≤1280px（沿用 vision-check 既有的 ≤1280 缩图口径），返回 data URL。 */
async function resizeImageDataUrlToMax(imageBase64: string, maxPx = AGNES_MAX_IMAGE_PX): Promise<string> {
  const buf = Buffer.from(stripDataUriPrefix(imageBase64), "base64");
  const meta = await sharp(buf).metadata();
  if ((meta.width || 0) <= maxPx && (meta.height || 0) <= maxPx) {
    return `data:image/${meta.format || "png"};base64,${buf.toString("base64")}`;
  }
  const resized = await sharp(buf)
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${resized.toString("base64")}`;
}

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AgnesVisionTextResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

/**
 * 工单 090：Agnes 免费视觉文字通道（OpenAI 兼容）。默认关闭；失败/超时/429
 * 一律返回 { ok:false } 交由既有降级，绝不抛错、不重试风暴。
 */
export async function agnesVisionText(
  prompt: string,
  imageBase64: string,
  opts: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<AgnesVisionTextResult> {
  if (process.env.VISION_ENABLE_AGNES !== "1") {
    return { ok: false, reason: "disabled" };
  }
  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_key" };
  }
  try {
    const dataUrl = await resizeImageDataUrlToMax(imageBase64);
    const baseUrl = String(opts.baseUrl || AGNES_API_BASE).replace(/\/+$/, "");
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AGNES_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs || AGNES_TIMEOUT_MS),
    });
    if (resp.status === 429) {
      // RPM 限流：短暂退避一次后交回既有降级，不重试风暴。
      await sleepMs(AGNES_429_BACKOFF_MS);
      return { ok: false, reason: "rate_limited" };
    }
    if (!resp.ok) {
      return { ok: false, reason: `http_${resp.status}` };
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = json.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : typeof content === "object" ? JSON.stringify(content) : "";
    if (!text) {
      return { ok: false, reason: "empty_response" };
    }
    return { ok: true, text };
  } catch (error) {
    return { ok: false, reason: `error:${(error as Error).name || "unknown"}` };
  }
}

export interface LogoFidelityFacts {
  logoPresent: boolean;
  shapePreserved: boolean;
  keyElementsPreserved: boolean;
  sceneComplete: boolean;
  integrationNatural: boolean;
  reason: string;
}

export interface LogoFidelityResult extends LogoFidelityFacts {
  status: "passed" | "failed" | "needs_review" | "skipped";
  model: string;
  raw?: string;
  checkedAt: string;
}

export interface MascotSceneFusionResult {
  status: "passed" | "failed" | "skipped";
  reason?: string;
  models: Array<{ model: string; parsed: Record<string, unknown> | null }>;
}

export interface AIDrawnSceneCheckResult {
  status: "passed" | "failed" | "needs_review" | "skipped";
  reason?: string;
  models: Array<{ model: string; parsed: Record<string, unknown> | null }>;
}

export interface SingleMascotStrictResult {
  status: "passed" | "failed" | "skipped";
  reason?: string;
  models: Array<{ model: string; parsed: Record<string, unknown> | null }>;
}

const STRICT_SINGLE_PROMPT =
  '请显式数出图片里的人物/公仔数量并逐个列出姿态，只输出JSON：{"characterCount":number,"poses":["front","side","back","other"],"noAnimalFeatures":true或false,"noWatermark":true或false,"personaOk":true或false,"reason":"一句话"}。characterCount=画面中的人物/公仔个数（多视角/多姿态也算多个，逐个数出来）；poses=每个姿态；noAnimalFeatures=true 仅当无角/兽耳/尾巴等动物特征；noWatermark=true 仅当无水印；personaOk=true 仅当符合温婉人类女神、玫瑰金/粉金配色人设。';

/** 工单 091-R4：单公仔严格判定=显式数人数+列姿态，双模型都过才算；多姿态/多角色即失败。 */
export async function runSingleMascotStrictCheck(
  imageBase64: string,
  opts: { models?: string[]; expectedPose?: "front" | "side" | "back" } = {},
): Promise<SingleMascotStrictResult> {
  const models = opts.models || ["qwen2.5vl:latest", "my-vl:latest"];
  await isOllamaAvailable(15_000).catch(() => false);
  let results: Array<{ model: string; parsed: Record<string, unknown> | null }> = [];
  for (let round = 0; round < 3; round++) {
    results = [];
    for (const model of models) {
      try {
        const raw = await aiDrawnOllamaGenerate(model, STRICT_SINGLE_PROMPT, imageBase64);
        let parsed: Record<string, unknown> | null = null;
        try {
          const s = raw.indexOf("{");
          const e = raw.lastIndexOf("}");
          parsed = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>;
        } catch {
          /* keep null */
        }
        results.push({ model, parsed });
      } catch {
        results.push({ model, parsed: null });
      }
    }
    if (results.filter((r) => r.parsed).length >= 2 || round === 2) break;
    await sleepMs(5000);
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) return { status: "skipped", reason: "vision_unavailable", models: results };
  const expected = opts.expectedPose;
  const passed = valid.every((r) => {
    const p = r.parsed as Record<string, unknown>;
    const poses = Array.isArray(p.poses) ? p.poses : [];
    return (
      p.characterCount === 1 &&
      poses.length === 1 &&
      (!expected || String(poses[0] || "").toLowerCase() === expected) &&
      p.noAnimalFeatures === true &&
      p.noWatermark === true &&
      p.personaOk === true
    );
  });
  return { status: passed ? "passed" : "failed", reason: passed ? undefined : "multi_subject_or_multi_pose_or_check_failed", models: results };
}

/** AI 入景验收专用 Ollama 直连（fetch，模型常驻 5 分钟，避免 ComfyUI 刚停时加载不稳）。 */
async function aiDrawnOllamaGenerate(model: string, prompt: string, imageBase64: string): Promise<string> {
  const payload = {
    model,
    prompt,
    images: [stripDataUriPrefix(imageBase64)],
    stream: false,
    keep_alive: "5m",
    options: { temperature: 0, num_predict: 400 },
  };
  const resp = await fetch(`${OLLAMA_API}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  if (!resp.ok) return "";
  const json = (await resp.json()) as { response?: string };
  return String(json.response || "").trim();
}

const AI_DRAWN_SCENE_PROMPT =
  '请评估这张品牌场景图中的 LOGO 呈现，只输出JSON：{"logoPresent":true或false,"noGarbledChinese":true或false,"noWatermark":true或false,"paletteOk":true或false,"sceneComplete":true或false,"reason":"一句话"}。logoPresent=场景物料上是否出现品牌 LOGO 图形（非空白底板）；noGarbledChinese=true 仅当无乱码/错字中文；noWatermark=true 仅当无水印；paletteOk=true 仅当配色符合玫瑰金/粉金品牌色系；sceneComplete=true 仅当是完整商业场景而非孤立 LOGO。无法确认填 false。';

/** 工单 091-R2：AI 入景绘制场景验收（LOGO 在场/无乱码中文/无水印/配色/场景完整；双模型）。 */
export async function runAIDrawnSceneCheck(
  imageBase64: string,
  opts: { models?: string[] } = {},
): Promise<AIDrawnSceneCheckResult> {
  const models = opts.models || ["qwen2.5vl:latest", "my-vl:latest"];
  let results: Array<{ model: string; parsed: Record<string, unknown> | null }> = [];
  // 工单 091-R2：ComfyUI 停止后 Ollama 模型需重载，先探活再重试（最多 3 轮×5s），
  // 避免把「视觉暂不可用」误判为场景不合格。
  await isOllamaAvailable(15_000).catch(() => false);
  for (let round = 0; round < 3; round++) {
    results = [];
    for (const model of models) {
      try {
        const raw = await aiDrawnOllamaGenerate(model, AI_DRAWN_SCENE_PROMPT, imageBase64);
        let parsed: Record<string, unknown> | null = null;
        try {
          const s = raw.indexOf("{");
          const e = raw.lastIndexOf("}");
          parsed = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>;
        } catch {
          /* keep null */
        }
        results.push({ model, parsed });
      } catch {
        results.push({ model, parsed: null });
      }
    }
    const valid = results.filter((r) => r.parsed);
    if (valid.length >= 2 || round === 2) break;
    await sleepMs(5000);
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) {
    return { status: "skipped", reason: "vision_unavailable", models: results };
  }
  // 工单 091-R2：AI 入景绘制验收——无水印双模型严格；
  // LOGO 在场/无乱码中文/配色/场景完整按多数（本地模型对抽象 LOGO 易误报，
  // 最终以 Chris 目检为准）。
  const maj = (fn: (p: Record<string, unknown>) => boolean) => valid.filter((r) => fn(r.parsed as Record<string, unknown>)).length >= Math.ceil(valid.length / 2);
  const noWm = valid.every((r) => (r.parsed as Record<string, unknown>).noWatermark === true);
  // sceneComplete 仅记录（产品/物料特写不属于「完整商业场景」，不作为过关条件）；
  // 过关=无水印（严格）+ LOGO 在场/无乱码中文/配色（多数）。
  const passed = noWm && maj((p) => p.logoPresent === true) && maj((p) => p.noGarbledChinese === true) && maj((p) => p.paletteOk === true);
  return {
    status: passed ? "passed" : "needs_review",
    reason: passed ? undefined : "ai_drawn_scene_check_failed",
    models: results,
  };
}

const MASCOT_SCENE_FUSION_PROMPT =
  '请评估这张场景图中的 IP 公仔是否自然融入场景，只输出JSON：{"naturalIntegration":true或false,"contactShadow":true或false,"matchingLighting":true或false,"noTextOverlap":true或false,"noHardEdges":true或false,"reason":"一句话"}。公仔脚下有接触阴影、光影与场景一致、文字/LOGO不与公仔主体重叠、边缘无硬抠图感才算通过；无法确认填false。';

/** 工单 091（P28）：场景融合双模型交叉断言（默认不进主流程，仅在公仔场景替换时调用）。 */
export async function runMascotSceneFusionCheck(
  imageBase64: string,
  opts: { models?: string[] } = {},
): Promise<MascotSceneFusionResult> {
  const models = opts.models || ["qwen2.5vl:latest", "my-vl:latest"];
  const results: Array<{ model: string; parsed: Record<string, unknown> | null }> = [];
  for (const model of models) {
    try {
      const raw = await ocrWithModel(model, MASCOT_SCENE_FUSION_PROMPT, imageBase64);
      let parsed: Record<string, unknown> | null = null;
      try {
        const s = raw.indexOf("{");
        const e = raw.lastIndexOf("}");
        parsed = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>;
      } catch {
        /* keep null */
      }
      results.push({ model, parsed });
    } catch {
      results.push({ model, parsed: null });
    }
  }
  const valid = results.filter((r) => r.parsed);
  if (valid.length < 2) {
    return { status: "skipped", reason: "vision_unavailable", models: results };
  }
  const passed = valid.every((r) => {
    const p = r.parsed as Record<string, unknown>;
    return p.noHardEdges === true && p.noTextOverlap === true && p.contactShadow === true;
  });
  return {
    status: passed ? "passed" : "failed",
    reason: passed ? undefined : "fusion_not_confirmed",
    models: results,
  };
}

/**
 * 工单 029：剥离 data URI 前缀。Ollama 的 images 字段只接受裸 base64；
 * 直接传 `data:image/png;base64,...` 会返回空 OCR（028 复现）。
 */
export function stripDataUriPrefix(image: string): string {
  const m = /^data:[^;]+;base64,([\s\S]+)$/.exec(image);
  return m ? m[1] : image;
}

function runCurl(
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      "curl.exe",
      args,
      { timeout: timeoutMs, windowsHide: true },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (err as NodeJS.ErrnoException).code ? 1 : 1 : 0,
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
        });
      },
    );
  });
}

/** 从模型文本中提取最后一个 JSON 对象（模型常先描述画面再输出 JSON）。 */
function extractJsonObjectFromText(text: string): Record<string, unknown> | null {
  const start = text.lastIndexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      /* 继续 */
    }
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as Record<string, unknown>;
    } catch {
      /* 继续 */
    }
  }
  return null;
}

/** Ollama 服务是否可达（只探活，不占显存）。工单 029：超时放宽到 10s，允许 1 次重试。 */
export async function isOllamaAvailable(timeoutMs = 10000): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
      const r = await runCurl(["-sS", "-m", String(seconds), `${OLLAMA_API}/api/version`], timeoutMs + 500);
      if (r.code === 0 && r.stdout.includes("version")) {
        return true;
      }
    } catch {
      /* 重试一次 */
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function ocrWithModel(model: string, prompt: string, imageBase64: string): Promise<string> {
  const payload = {
    model,
    prompt,
    images: [stripDataUriPrefix(imageBase64)],
    stream: false,
    // 工单 029：校验后立即卸载模型，避免驻留显存与 ComfyUI 并发冲突。
    keep_alive: 0,
    options: { temperature: 0, num_predict: 200 },
  };
  const tmpIn = path.join(os.tmpdir(), `vision-in-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const tmpOut = tmpIn + ".out";
  await fs.promises.writeFile(tmpIn, JSON.stringify(payload), "utf8");
  try {
    const r = await runCurl(
      [
        "-sS",
        "-m",
        "240",
        "-X",
        "POST",
        `${OLLAMA_API}/api/generate`,
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        `@${tmpIn}`,
        "--output",
        tmpOut,
      ],
      250000,
    );
    if (r.code !== 0) {
      throw new Error(`curl failed: ${r.stderr.slice(0, 200)}`);
    }
    const raw = await fs.promises.readFile(tmpOut, "utf8");
    const parsed = JSON.parse(raw) as { response?: string };
    return String(parsed.response || "").trim();
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {});
    fs.promises.unlink(tmpOut).catch(() => {});
  }
}

export function buildLogoFidelityPayload(
  model: string,
  referenceImageBase64: string,
  candidateImageBase64: string,
): Record<string, unknown> {
  return {
    model,
    prompt: LOGO_FIDELITY_PROMPT,
    images: [stripDataUriPrefix(referenceImageBase64), stripDataUriPrefix(candidateImageBase64)],
    stream: false,
    keep_alive: 0,
    options: { temperature: 0, num_predict: 300 },
  };
}

export function evaluateLogoFidelityFacts(facts: LogoFidelityFacts): LogoFidelityResult["status"] {
  const allPass = facts.logoPresent && facts.shapePreserved && facts.keyElementsPreserved
    && facts.sceneComplete && facts.integrationNatural;
  if (allPass) return "passed";
  if (!facts.logoPresent || !facts.sceneComplete) return "failed";
  return "needs_review";
}

export function parseLogoFidelityResult(raw: string, model = "my-vl"): LogoFidelityResult {
  const parsed = extractJsonObjectFromText(raw);
  const keys = ["logoPresent", "shapePreserved", "keyElementsPreserved", "sceneComplete", "integrationNatural"] as const;
  const valid = parsed && keys.every((key) => typeof parsed[key] === "boolean");
  const facts: LogoFidelityFacts = {
    logoPresent: valid ? parsed.logoPresent === true : false,
    shapePreserved: valid ? parsed.shapePreserved === true : false,
    keyElementsPreserved: valid ? parsed.keyElementsPreserved === true : false,
    sceneComplete: valid ? parsed.sceneComplete === true : false,
    integrationNatural: valid ? parsed.integrationNatural === true : false,
    reason: valid && typeof parsed.reason === "string" ? parsed.reason : "invalid_or_incomplete_json",
  };
  return {
    ...facts,
    status: valid ? evaluateLogoFidelityFacts(facts) : "needs_review",
    model,
    raw,
    checkedAt: new Date().toISOString(),
  };
}

async function logoFidelityWithModel(
  model: string,
  referenceImageBase64: string,
  candidateImageBase64: string,
): Promise<string> {
  const payload = buildLogoFidelityPayload(model, referenceImageBase64, candidateImageBase64);
  const tmpIn = path.join(os.tmpdir(), `logo-fidelity-in-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const tmpOut = tmpIn + ".out";
  await fs.promises.writeFile(tmpIn, JSON.stringify(payload), "utf8");
  try {
    const response = await runCurl([
      "-sS", "-m", "240", "-X", "POST", `${OLLAMA_API}/api/generate`,
      "-H", "Content-Type: application/json", "--data-binary", `@${tmpIn}`, "--output", tmpOut,
    ], 250000);
    if (response.code !== 0) throw new Error(`curl failed: ${response.stderr.slice(0, 200)}`);
    const raw = await fs.promises.readFile(tmpOut, "utf8");
    const parsed = JSON.parse(raw) as { response?: string };
    return String(parsed.response || "").trim();
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {});
    fs.promises.unlink(tmpOut).catch(() => {});
  }
}

/** 工单 073：同一次请求把原 Logo 与候选场景送入本地视觉模型，五项全真才通过。 */
export async function runLogoFidelityVisionCheck(options: {
  referenceImageBase64: string;
  candidateImageBase64: string;
  model?: string;
}): Promise<LogoFidelityResult> {
  const model = options.model || "my-vl";
  if (!(await isOllamaAvailable())) {
    return {
      logoPresent: false,
      shapePreserved: false,
      keyElementsPreserved: false,
      sceneComplete: false,
      integrationNatural: false,
      reason: "ollama_unavailable",
      status: "skipped",
      model,
      checkedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = await logoFidelityWithModel(model, options.referenceImageBase64, options.candidateImageBase64);
    return parseLogoFidelityResult(raw, model);
  } catch (error) {
    return {
      logoPresent: false,
      shapePreserved: false,
      keyElementsPreserved: false,
      sceneComplete: false,
      integrationNatural: false,
      reason: `vision_error: ${(error as Error).message.slice(0, 160)}`,
      status: "needs_review",
      model,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * 工单 029：OCR 带 1 次重试。空/乱码结果视为 OCR 失败，返回 garbled=true，
 * 由调用方决定重试/降级，绝不把“空 OCR”当作内容不合格。
 */
async function ocrWithRetry(
  model: string,
  prompt: string,
  imageBase64: string,
): Promise<{ text: string; garbled: boolean }> {
  let text = "";
  try {
    text = await ocrWithModel(model, prompt, imageBase64);
  } catch {
    text = "";
  }
  if (!looksGarbled(text)) {
    return { text, garbled: false };
  }
  try {
    text = await ocrWithModel(model, prompt, imageBase64);
  } catch {
    text = "";
  }
  return { text, garbled: looksGarbled(text) };
}

/**
 * 归一化用于比对：中文只留汉字，拼音只留字母/数字（忽略大小写与空格）。
 */
export function normalizeForCompare(text: string, mode: LogoTextMode): string {
  if (mode === "chinese") {
    return (text.match(/[\u4e00-\u9fff]/g) || []).join("");
  }
  return (text.toUpperCase().match(/[A-Z0-9]/g) || []).join("");
}

/**
 * 按 024 契约取期望文本：中文=正式品牌名（公司名称字段）；拼音=从提示词中
 * 提取 DeepSeek 写入的拼音（如 Text 'LAOWANXIANG' 或 「LAOWANXIANG」）。
 * 提取不到返回空串（调用方应降级为 skipped）。
 */
export function extractExpectedText(
  prompt: string | undefined,
  mode: LogoTextMode,
  companyName: string,
): string {
  if (mode === "chinese") {
    return normalizeForCompare(companyName, "chinese");
  }
  if (prompt) {
    const quoted =
      prompt.match(/['"`]([A-Za-z][A-Za-z0-9\s-]*)['"`]/) ||
      prompt.match(/「([A-Za-z][A-Za-z0-9\s-]*)」/);
    if (quoted) {
      return normalizeForCompare(quoted[1], "pinyin");
    }
  }
  return "";
}

/** 乱码/空文本启发式：空、含替换符 �、或既无汉字也无字母数字。 */
export function looksGarbled(text: string): boolean {
  if (!text) return true;
  if (text.includes("\uFFFD")) return true;
  const cn = normalizeForCompare(text, "chinese");
  const en = normalizeForCompare(text, "pinyin");
  return cn.length === 0 && en.length === 0;
}

/**
 * 执行一次文字型视觉校验（Logo/场景共用管道）。
 * - 3B 粗筛通过 → passed（不升级 7B）；
 * - 3B 疑似/不符 → 7B（my-vl）终审；7B 与期望一致 → passed，否则 suspect；
 * - Ollama 不可达 / 期望文本缺失 / OCR 调用失败 → skipped（未初检），带 reason。
 */
async function runTextVisionCheckLocal(opts: {
  imageBase64: string;
  prompt?: string;
  expectedText: string;
  mode: LogoTextMode;
  coarseModel?: string;
  fineModel?: string;
}): Promise<VisionCheckResult> {
  const mode = opts.mode;
  const coarseModel = opts.coarseModel || "qwen2.5vl:3b";
  const fineModel = opts.fineModel || "my-vl";
  const expectedText = opts.expectedText;
  const base: VisionCheckResult = {
    status: "skipped",
    mode,
    expectedText,
    coarseModel,
    fineModel,
    checkedAt: new Date().toISOString(),
  };
  if (!expectedText) {
    return { ...base, reason: "expected_text_unavailable" };
  }
  if (!(await isOllamaAvailable())) {
    return { ...base, reason: "ollama_unavailable" };
  }

  const expectedNorm = normalizeForCompare(expectedText, mode);
  const coarse = await ocrWithRetry(coarseModel, OCR_PROMPT, opts.imageBase64);
  const coarseText = coarse.text;

  if (coarse.garbled) {
    // 空/乱码 OCR：给 7B 一次机会；仍空 → skipped(ocr_empty)，不升级 needs_review。
    const fine = await ocrWithRetry(fineModel, OCR_PROMPT, opts.imageBase64);
    if (fine.garbled) {
      return { ...base, status: "skipped", reason: "ocr_empty", coarseText };
    }
    const fineNorm = normalizeForCompare(fine.text, mode);
    if (fineNorm === expectedNorm) {
      return { ...base, status: "passed", coarseText, fineText: fine.text };
    }
    return { ...base, status: "suspect", coarseText, fineText: fine.text };
  }

  const coarseNorm = normalizeForCompare(coarseText, mode);
  if (coarseNorm === expectedNorm) {
    return { ...base, status: "passed", coarseText };
  }

  // 有效 OCR 但与期望不符 → 7B 终审
  let fineText = "";
  try {
    fineText = await ocrWithModel(fineModel, OCR_PROMPT, opts.imageBase64);
  } catch (e) {
    return {
      ...base,
      status: "suspect",
      coarseText,
      reason: `fine_error: ${(e as Error).message.slice(0, 120)}`,
    };
  }
  const fineNorm = normalizeForCompare(fineText, mode);
  if (fineNorm === expectedNorm && !looksGarbled(fineText)) {
    return { ...base, status: "passed", coarseText, fineText };
  }
  return { ...base, status: "suspect", coarseText, fineText };
}

/**
 * 工单 090：Agnes 交叉复核接线。默认关闭（VISION_ENABLE_AGNES=1 才启用）；
 * 启用后本地 passed 但 Agnes OCR 与期望不符 → 降级 suspect（fail-closed，
 * 不静默放行）；Agnes 不可用 → 保持本地结果不变（走既有降级）。
 */
export async function runTextVisionCheck(opts: {
  imageBase64: string;
  prompt?: string;
  expectedText: string;
  mode: LogoTextMode;
  coarseModel?: string;
  fineModel?: string;
}): Promise<VisionCheckResult> {
  const result = await runTextVisionCheckLocal(opts);
  if (process.env.VISION_ENABLE_AGNES !== "1") {
    return result;
  }
  const agnes = await agnesVisionText(OCR_PROMPT, opts.imageBase64);
  if (!agnes.ok || !agnes.text) {
    return { ...result, agnesStatus: `unavailable:${agnes.reason || "unknown"}` };
  }
  const agnesNorm = normalizeForCompare(agnes.text, opts.mode);
  const expectedNorm = normalizeForCompare(opts.expectedText, opts.mode);
  if (result.status === "passed" && (agnesNorm !== expectedNorm || looksGarbled(agnes.text))) {
    return {
      ...result,
      status: "suspect",
      reason: "agnes_cross_check_mismatch",
      agnesText: agnes.text,
      agnesStatus: "checked",
    };
  }
  return { ...result, agnesText: agnes.text, agnesStatus: "checked" };
}

/**
 * Logo 校验（保持既有接口）：文字逐字比对。
 */
export function runLogoVisionCheck(opts: {
  imageBase64: string;
  prompt?: string;
  expectedText: string;
  mode: LogoTextMode;
  coarseModel?: string;
  fineModel?: string;
}): Promise<VisionCheckResult> {
  return runTextVisionCheck(opts);
}

/**
 * 场景图校验（工单 031）：品牌文字校验（同 Logo 管道）＋清晰度/无乱码粗检。
 * 文字不过/清晰度异常 → suspect（交批次下一轮重生成）；空 OCR → skipped。
 */
export async function runSceneVisionCheck(opts: {
  imageBase64: string;
  expectedText: string;
  mode: LogoTextMode;
  coarseModel?: string;
  fineModel?: string;
}): Promise<VisionCheckResult> {
  const coarseModel = opts.coarseModel || "qwen2.5vl:3b";
  const fineModel = opts.fineModel || "my-vl";
  const base: VisionCheckResult = {
    status: "skipped",
    mode: opts.mode,
    expectedText: opts.expectedText,
    coarseModel,
    fineModel,
    checkedAt: new Date().toISOString(),
  };
  if (!opts.expectedText) {
    return { ...base, reason: "expected_text_unavailable" };
  }
  if (!(await isOllamaAvailable())) {
    return { ...base, reason: "ollama_unavailable" };
  }
  const textCheck = await runTextVisionCheck(opts);
  if (textCheck.status !== "passed") {
    return textCheck;
  }
  // 清晰度粗检（3B）；“有问题/模糊/乱码/水印” → suspect
  const clarity = await ocrWithRetry(coarseModel, CLARITY_PROMPT, opts.imageBase64);
  if (!clarity.garbled && /有问题|模糊|乱码|水印|不清/.test(clarity.text)) {
    return {
      ...base,
      status: "suspect",
      coarseText: textCheck.coarseText,
      reason: "clarity_issue",
    };
  }
  return textCheck;
}

/**
 * 工单 044：照片→场景图专用校验。门店照片天然含其它墙面文字，因此采用
 * “品牌名出现在 OCR 文本中”的子串语义（而非整图文字全等）：
 * 3B 粗筛包含→passed；否则 my-vl 终审包含→passed；仍不含→suspect。
 */
export async function runPhotoSceneVisionCheck(opts: {
  imageBase64: string;
  expectedText: string;
  mode: LogoTextMode;
  coarseModel?: string;
  fineModel?: string;
}): Promise<VisionCheckResult> {
  const mode = opts.mode;
  const coarseModel = opts.coarseModel || "qwen2.5vl:3b";
  const fineModel = opts.fineModel || "my-vl";
  const expectedText = opts.expectedText;
  const base: VisionCheckResult = {
    status: "skipped",
    mode,
    expectedText,
    coarseModel,
    fineModel,
    checkedAt: new Date().toISOString(),
  };
  if (!expectedText) return { ...base, reason: "expected_text_unavailable" };
  if (!(await isOllamaAvailable())) return { ...base, reason: "ollama_unavailable" };

  const expectedNorm = normalizeForCompare(expectedText, mode);
  if (!expectedNorm) return { ...base, reason: "expected_text_unavailable" };

  const coarse = await ocrWithRetry(coarseModel, OCR_PROMPT, opts.imageBase64);
  if (!coarse.garbled) {
    const coarseNorm = normalizeForCompare(coarse.text, mode);
    if (coarseNorm.includes(expectedNorm)) {
      return { ...base, status: "passed", coarseText: coarse.text };
    }
  }

  // 粗筛不含（或乱码）→ 7B 终审（子串语义）
  let fineText = "";
  try {
    fineText = await ocrWithModel(fineModel, OCR_PROMPT, opts.imageBase64);
  } catch (e) {
    return {
      ...base,
      status: "suspect",
      coarseText: coarse.text,
      reason: `fine_error: ${(e as Error).message.slice(0, 120)}`,
    };
  }
  const fineNorm = normalizeForCompare(fineText, mode);
  if (fineNorm.includes(expectedNorm)) {
    return { ...base, status: "passed", coarseText: coarse.text, fineText };
  }
  return { ...base, status: "suspect", coarseText: coarse.text, fineText };
}

/** 解析公仔完整性 JSON（容错：剥离代码围栏、正则回退）。 */
export function parseMascotJson(text: string): {
  complete: boolean;
  singleSubject: boolean;
  whiteBackground: boolean;
  noWatermark: boolean;
  reason: string;
} {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const obj: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") Object.assign(obj, parsed);
  } catch {
    for (const key of ["complete", "singleSubject", "whiteBackground", "noWatermark"]) {
      const m = new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i").exec(cleaned);
      if (m) obj[key] = m[1].toLowerCase() === "true";
    }
    const r = /"reason"\s*:\s*"([^"]*)"/.exec(cleaned);
    if (r) obj.reason = r[1];
  }
  return {
    complete: obj.complete === true,
    singleSubject: obj.singleSubject === true,
    whiteBackground: obj.whiteBackground === true,
    noWatermark: obj.noWatermark === true,
    reason: typeof obj.reason === "string" ? obj.reason : "",
  };
}

async function mascotEval(
  model: string,
  imageBase64: string,
  requireWhiteBackground: boolean,
): Promise<{ ok: boolean; text: string; garbled: boolean; parsed: ReturnType<typeof parseMascotJson> | null }> {
  const r = await ocrWithRetry(model, MASCOT_CHECK_PROMPT, imageBase64);
  const parsed = r.garbled ? null : parseMascotJson(r.text);
  // 工单 031 补验：场景图（公仔在门店/包装/社媒环境）天然非纯白背景，
  // requireWhiteBackground=false 时跳过 whiteBackground 判定，避免误报 needs_review。
  const ok =
    parsed !== null &&
    parsed.complete &&
    parsed.singleSubject &&
    parsed.noWatermark &&
    (requireWhiteBackground ? parsed.whiteBackground : true);
  return { ok, text: r.text, garbled: r.garbled, parsed };
}

/**
 * 公仔完整性校验（工单 031）：3B 粗检 → 疑似件 7B 终审。
 * 不做逐字匹配（公仔图通常无文字）；空/乱码 → 重试 → skipped。
 */
export async function runMascotVisionCheck(opts: {
  imageBase64: string;
  coarseModel?: string;
  fineModel?: string;
  requireWhiteBackground?: boolean;
}): Promise<VisionCheckResult> {
  const coarseModel = opts.coarseModel || "qwen2.5vl:3b";
  const fineModel = opts.fineModel || "my-vl";
  const requireWhiteBackground = opts.requireWhiteBackground !== false;
  const base: VisionCheckResult = {
    status: "skipped",
    mode: "chinese",
    expectedText: "",
    coarseModel,
    fineModel,
    checkedAt: new Date().toISOString(),
  };
  if (!(await isOllamaAvailable())) {
    return { ...base, reason: "ollama_unavailable" };
  }
  const coarse = await mascotEval(coarseModel, opts.imageBase64, requireWhiteBackground);
  if (coarse.garbled) {
    const fine = await mascotEval(fineModel, opts.imageBase64, requireWhiteBackground);
    if (fine.garbled) {
      return { ...base, status: "skipped", reason: "ocr_empty" };
    }
    return fine.ok
      ? { ...base, status: "passed", coarseText: coarse.text, fineText: fine.text }
      : { ...base, status: "suspect", coarseText: coarse.text, fineText: fine.text, reason: fine.parsed?.reason };
  }
  if (coarse.ok) {
    return { ...base, status: "passed", coarseText: coarse.text };
  }
  const fine = await mascotEval(fineModel, opts.imageBase64, requireWhiteBackground);
  if (fine.ok) {
    return { ...base, status: "passed", coarseText: coarse.text, fineText: fine.text };
  }
  return {
    ...base,
    status: "suspect",
    coarseText: coarse.text,
    fineText: fine.text,
    reason: fine.parsed?.reason || coarse.parsed?.reason || "mascot_integrity",
  };
}

// ===== 工单 062：公仔场景校验门（场景完整性 + 五官 + 核色） =====

const MASCOT_SCENE_EVAL_PROMPT =
  "Analyze this mascot scene image. Output ONLY a JSON object: " +
  '{"sceneComplete": true/false, "faceComplete": true/false, "reason": "short note"}. ' +
  "sceneComplete=true only if a recognizable commercial scene/background exists " +
  "(e.g. storefront, packaging, membership card, interior) and the mascot is placed IN the scene, " +
  "NOT a close-up element-only portrait on an empty background. " +
  "faceComplete=true only if the mascot has clear facial features (eyes, nose, mouth visible). " +
  "Do not output anything else.";

export interface MascotSceneEval {
  sceneComplete: boolean;
  faceComplete: boolean;
  reason?: string;
}

/** 容错解析公仔场景评估 JSON（剥代码围栏、取首尾花括号）。失败返回 null。 */
export function parseMascotSceneEval(text: string): MascotSceneEval | null {
  const cleaned = (text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      sceneComplete: parsed.sceneComplete === true,
      faceComplete: parsed.faceComplete === true,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}

export type MascotSceneVisionCheckResult = VisionCheckResult & {
  sceneComplete?: boolean;
  faceComplete?: boolean;
  palette?: BrandColorCheckResult;
};

/**
 * 公仔场景校验门（工单 062）：3B 粗筛 → 疑似 7B 终审；
 * 判定=场景完整性 + 五官完整 + （可选）核色。Ollama 不可用 → skipped。
 */
export async function runMascotSceneVisionCheck(opts: {
  imageBase64: string;
  coarseModel?: string;
  fineModel?: string;
  expectedColors?: { hex: string; name?: string }[];
  colorThreshold?: number;
}): Promise<MascotSceneVisionCheckResult> {
  const coarseModel = opts.coarseModel || "qwen2.5vl:3b";
  const fineModel = opts.fineModel || "my-vl";
  const base: VisionCheckResult = {
    status: "skipped",
    mode: "chinese",
    expectedText: "",
    coarseModel,
    fineModel,
    checkedAt: new Date().toISOString(),
  };
  if (!(await isOllamaAvailable())) {
    return { ...base, reason: "ollama_unavailable" };
  }
  const coarse = await ocrWithModel(coarseModel, MASCOT_SCENE_EVAL_PROMPT, opts.imageBase64);
  let parsed = parseMascotSceneEval(coarse);
  if (!parsed || !parsed.sceneComplete || !parsed.faceComplete) {
    const fine = await ocrWithModel(fineModel, MASCOT_SCENE_EVAL_PROMPT, opts.imageBase64);
    const fineParsed = parseMascotSceneEval(fine);
    if (fineParsed) parsed = fineParsed;
  }
  const sceneComplete = parsed?.sceneComplete === true;
  const faceComplete = parsed?.faceComplete === true;
  let palette: BrandColorCheckResult | undefined;
  if (opts.expectedColors && opts.expectedColors.length) {
    palette = await checkBrandColors({
      imageBase64: opts.imageBase64,
      palette: opts.expectedColors,
      threshold: opts.colorThreshold,
    });
  }
  const paletteOk = !palette || palette.status === "skipped" || palette.status === "passed";
  const ok = sceneComplete && faceComplete && paletteOk;
  return {
    ...base,
    status: ok ? "passed" : "suspect",
    reason: ok
      ? undefined
      : `sceneComplete=${sceneComplete},faceComplete=${faceComplete},palette=${palette?.status || "n/a"}`,
    coarseText: coarse,
    sceneComplete,
    faceComplete,
    palette,
  };
}

// ===== 工单 033：三视图一致性（角色描述动态生成 + 7B 特征交叉比对） =====

/** 从公仔样稿提取可复用角色描述（7B 视觉，动态生成，禁止硬编码模板）。失败返回 ""。 */
const MASCOT_SPEC_PROMPT =
  "Analyze this mascot character design image. Extract a detailed, reusable character description in English " +
  "covering: body type and proportions, main colors and color scheme, headwear/ears/antlers, hairstyle, " +
  "outfit and clothing details, accessories, and overall art style (e.g. 3D Pixar). " +
  "Output only the description text, no extra commentary.";

export async function extractMascotCharacterSpec(
  imageBase64: string,
  opts?: { fineModel?: string },
): Promise<string> {
  const model = opts?.fineModel || "my-vl";
  try {
    const text = await ocrWithModel(model, MASCOT_SPEC_PROMPT, imageBase64);
    return (text || "").trim();
  } catch {
    return "";
  }
}

const MASCOT_FEATURE_PROMPT =
  "Analyze this mascot image. Output ONLY a JSON object with these array keys: colors, headwear, hairstyle, " +
  "outfit, bodyType, accessories. Each array contains short English keywords describing that aspect of the " +
  "character's design. Do not output anything else.";

export interface MascotFeatures {
  colors: string[];
  headwear: string[];
  hairstyle: string[];
  outfit: string[];
  bodyType: string[];
  accessories: string[];
}

/** 容错解析 7B 特征 JSON（剥离代码围栏、取首尾花括号）；失败返回 null。 */
export function parseMascotFeatures(text: string): MascotFeatures | null {
  const cleaned = (text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const norm = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    };
    return {
      colors: norm(parsed.colors),
      headwear: norm(parsed.headwear),
      hairstyle: norm(parsed.hairstyle),
      outfit: norm(parsed.outfit),
      bodyType: norm(parsed.bodyType),
      accessories: norm(parsed.accessories),
    };
  } catch {
    return null;
  }
}

// 工单 033：身份关键特征加权。outfit/headwear 权重最高（决定“同一角色”），
// 泛化维度（bodyType/accessories）压低；配合“outfit 必须相似”门槛。
const FEATURE_WEIGHTS: Record<keyof MascotFeatures, number> = {
  colors: 0.15,
  headwear: 0.2,
  hairstyle: 0.15,
  outfit: 0.3,
  bodyType: 0.1,
  accessories: 0.1,
};

const GENERIC_FEATURE_TOKENS = new Set(["none", "unknown", "n/a", "na", "not applicable"]);

// 工单 033：通用同义词归一（仅比对用，不含任何品牌/角色模板；应对 7B 措辞漂移）。
const FEATURE_SYNONYMS: Record<string, string> = {
  robe: "gown",
  kimono: "gown",
  dress: "gown",
  shirt: "top",
  blouse: "top",
  pants: "trousers",
  trousers: "trousers",
  sash: "belt",
};

function featureTokenSet(words: string[]): Set<string> {
  const s = new Set<string>();
  for (const w of words) {
    for (const raw of w.toLowerCase().split(/[^a-z0-9]+/)) {
      if (!raw) continue;
      const t = FEATURE_SYNONYMS[raw] || raw;
      if (t) s.add(t);
    }
  }
  return s;
}

function featureOverlap(a: string[], b: string[]): number {
  const sa = featureTokenSet(a);
  const sb = featureTokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let hit = 0;
  for (const t of sa) if (sb.has(t)) hit++;
  return hit / Math.min(sa.size, sb.size);
}

/** 清理泛化 token（none/unknown 等）与空串，避免稀释身份差异。 */
function cleanFeatureList(words: string[]): string[] {
  return words.filter((w) => {
    const t = w.trim().toLowerCase();
    return t !== "" && !GENERIC_FEATURE_TOKENS.has(t);
  });
}

/** 两视图特征相似度 0..1（加权 token 重叠）。 */
export function mascotFeatureSimilarity(a: MascotFeatures, b: MascotFeatures): number {
  let total = 0;
  (Object.keys(FEATURE_WEIGHTS) as (keyof MascotFeatures)[]).forEach((k) => {
    total += FEATURE_WEIGHTS[k] * featureOverlap(cleanFeatureList(a[k]), cleanFeatureList(b[k]));
  });
  return total;
}

export type ThreeViewStatus = "passed" | "needs_review" | "skipped";

export interface ThreeViewConsistencyResult {
  status: ThreeViewStatus;
  reason?: string;
  features?: Record<"front" | "side" | "back", MascotFeatures | null>;
  pairwise?: { frontSide: number; sideBack: number; frontBack: number };
}

/** 纯函数判定（可单测）：三对加权相似度均值低于阈值，或正/背 outfit 不相似 → needs_review；任一张为空 → skipped。 */
export function decideThreeViewConsistency(
  features: Record<"front" | "side" | "back", MascotFeatures | null>,
  threshold = 0.55,
  outfitGate = 0.3,
): ThreeViewConsistencyResult {
  if (!features.front || !features.side || !features.back) {
    const missing = (["front", "side", "back"] as const).filter((k) => !features[k]);
    return { status: "skipped", reason: `feature_extract_failed: ${missing.join(",")}`, features };
  }
  const frontSide = mascotFeatureSimilarity(features.front, features.side);
  const sideBack = mascotFeatureSimilarity(features.side, features.back);
  const frontBack = mascotFeatureSimilarity(features.front, features.back);
  const pairwise = { frontSide, sideBack, frontBack };
  const outfitSim = (x: MascotFeatures, y: MascotFeatures): number =>
    featureOverlap(cleanFeatureList(x.outfit), cleanFeatureList(y.outfit));
  const avg = (frontSide + sideBack + frontBack) / 3;
  if (avg >= threshold && outfitSim(features.front, features.back) >= outfitGate) {
    return { status: "passed", features, pairwise };
  }
  return {
    status: "needs_review",
    reason:
      `three_view_inconsistent (avg=${avg.toFixed(2)}, frontSide=${frontSide.toFixed(2)}, sideBack=${sideBack.toFixed(2)}, ` +
      `frontBack=${frontBack.toFixed(2)}, threshold=${threshold}, outfitGate=${outfitGate})`,
    features,
    pairwise,
  };
}

/**
 * 三视图一致性判定（工单 033）：对 front/side/back 三张分别做 7B 特征提取
 * （配色/服装/头饰/体型等），三对加权相似度均值低于阈值，或正/背 outfit 不相似
 * → needs_review（不静默交付）。任一张特征提取失败 → skipped（未初检）。
 * 阈值默认 0.55，正/背 outfit 门槛默认 0.3，均可传参覆盖。
 */
export async function runThreeViewConsistencyCheck(opts: {
  front: string;
  side: string;
  back: string;
  fineModel?: string;
  threshold?: number;
}): Promise<ThreeViewConsistencyResult> {
  const model = opts.fineModel || "my-vl";
  const features: Record<"front" | "side" | "back", MascotFeatures | null> = {
    front: null,
    side: null,
    back: null,
  };
  for (const key of ["front", "side", "back"] as const) {
    try {
      const text = await ocrWithModel(model, MASCOT_FEATURE_PROMPT, opts[key]);
      features[key] = parseMascotFeatures(text);
    } catch {
      features[key] = null;
    }
  }
  return decideThreeViewConsistency(features, opts.threshold);
}

// ===== 工单 042：客户上传 Logo 4 槽方案 =====

export interface UploadedLogoCheck {
  valid: boolean;
  url?: string;
}

/**
 * 校验客户上传 Logo 素材是否真实完整：数组非空，且至少一个元素含 http(s) URL。
 * 禁止仅凭布尔/非空对象判断（020 契约精神）。返回首个有效 URL 作为主素材。
 */
export function isValidUploadedLogoAssets(assets: unknown): UploadedLogoCheck {
  if (!Array.isArray(assets) || assets.length === 0) {
    return { valid: false };
  }
  for (const a of assets) {
    if (a && typeof a === "object") {
      const url = String((a as { url?: unknown }).url ?? "").trim();
      if (/^https?:\/\/\S+$/i.test(url)) {
        return { valid: true, url };
      }
    }
  }
  return { valid: false };
}

const LOGO_SPEC_PROMPT =
  "请分析这张客户提供的Logo图，只输出中文描述：1)核心图形元素（图形/符号/文字）" +
  " 2)构图与布局 3)品牌名或文字内容（逐字提取） 4)视觉风格 5)主色调。不要给修改建议。";

/** 用 my-vl（7B）提取上传 Logo 特征描述（动态生成，不硬编码客户素材）。失败返回空串。 */
export async function describeLogoForOptimization(
  imageBase64: string,
  opts?: { fineModel?: string },
): Promise<string> {
  const model = opts?.fineModel || "my-vl";
  try {
    const text = await ocrWithModel(model, LOGO_SPEC_PROMPT, imageBase64);
    return (text || "").trim();
  } catch {
    return "";
  }
}

/**
 * 工单 042：组装“优化版”提示词——保留客户图形语义，按品牌分析色板重新配色，
 * 品牌名由平台写入；遵循 023 约束（现代扁平、白底、每字一次、禁印章/篆书/雕刻）。
 * 纯函数（可单测）；品牌名/颜色均来自显式参数，禁止硬编码具体客户素材。
 */
export function buildOptimizedLogoPrompt(opts: {
  description: string;
  brandName: string;
  brandColors: string[];
  mode?: LogoTextMode;
}): string {
  const { description, brandName, brandColors, mode = "chinese" } = opts;
  const colorText = brandColors.length > 0 ? `，品牌色：${brandColors.join("、")}` : "";
  if (mode === "pinyin") {
    const pinyin = brandName.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (
      `基于客户上传Logo的优化设计：保留原有图形语义（${description}）。` +
      `品牌名以「${pinyin}」拼音大字呈现，No Chinese characters，现代简约扁平、白色背景` +
      `${colorText}。禁止印章/篆书/雕刻；品牌名是唯一文字主角。`
    );
  }
  return (
    `基于客户上传Logo的优化设计：保留原有图形语义（${description}）。` +
    `中文品牌名「${brandName}」清晰为主视觉，现代简约扁平、白色背景，` +
    `每个字只出现一次、无重复、无多余文字、无错字` +
    `${colorText}。` +
    `禁止 seal stamp、印章、篆书、雕刻、engraved、环形小字、仿古纹样。`
  );
}

// ========== 工单 044：门店照片→场景图（定位/蒙版/核色） ==========

export interface TextRegion {
  /** 归一化百分比坐标（0-100，左上原点） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 容错解析 7B 返回的 bbox JSON。支持两种格式：
 * 1) 百分比单框对象 {"x1":..,"y1":..,"x2":..,"y2":..}
 * 2) 像素 bbox 数组 [{"bbox_2d":[x1,y1,x2,y2],"label":..},...]（自动取并集，
 *    需传入图片宽高转百分比）
 * 正则回退：连续 4 个数字。
 */
export function parseTextRegionJson(
  text: string,
  opts?: { width?: number; height?: number },
): TextRegion | null {
  const cleaned = (text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  const w = opts?.width || 100;
  const h = opts?.height || 100;
  if (Array.isArray(parsed)) {
    const boxes = (parsed as Array<{ bbox_2d?: number[] }>)
      .map((b) => (b && Array.isArray(b.bbox_2d) ? b.bbox_2d.map(Number) : null))
      .filter((b): b is number[] => !!b && b.length >= 4 && b.every(Number.isFinite));
    if (boxes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes) {
      minX = Math.min(minX, b[0]);
      minY = Math.min(minY, b[1]);
      maxX = Math.max(maxX, b[2]);
      maxY = Math.max(maxY, b[3]);
    }
    x1 = (minX / w) * 100;
    y1 = (minY / h) * 100;
    x2 = (maxX / w) * 100;
    y2 = (maxY / h) * 100;
  } else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    x1 = Number(o.x1);
    y1 = Number(o.y1);
    x2 = Number(o.x2);
    y2 = Number(o.y2);
  } else {
    const nums = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length < 4) return null;
    [x1, y1, x2, y2] = nums;
    if (x1 > 100 || y1 > 100 || x2 > 100 || y2 > 100) {
      x1 = (x1 / w) * 100;
      y1 = (y1 / h) * 100;
      x2 = (x2 / w) * 100;
      y2 = (y2 / h) * 100;
    }
  }
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  if (x1 < 0 || y1 < 0 || x2 > 100 || y2 > 100 || x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
}

const TEXT_REGION_PROMPT =
  "门店照片文字定位任务。请找出图片中所有文字的边界框，只输出 JSON 数组，" +
  '每个元素格式：{"bbox_2d":[x1,y1,x2,y2],"label":"文字内容"}，' +
  "x/y 为像素坐标（图片左上角为原点，x1<x2，y1<y2），覆盖全部主要文字。" +
  "不要输出任何其他文字或解释。";

/** 用 my-vl（7B）定位照片中的文字区域（动态，禁止硬编码坐标）。失败返回 null。 */
export async function locateTextRegion(
  imagePath: string,
  opts?: { model?: string },
): Promise<TextRegion | null> {
  try {
    const buf = await fs.promises.readFile(imagePath);
    const meta = await sharp(imagePath).metadata();
    const width = meta.width || 1024;
    const height = meta.height || 1024;
    const text = await ocrWithModel(
      opts?.model || "my-vl",
      TEXT_REGION_PROMPT,
      buf.toString("base64"),
    );
    return parseTextRegionJson(text || "", { width, height });
  } catch {
    return null;
  }
}

const STOREFRONT_PROMPT =
  '请判断这张照片是否包含门店/店铺的正立面、门头或招牌。只输出 JSON：' +
  '{"isStorefront":true或false}。不要解释。';

/** 判断一张照片是否为门店正立面/门头照（7B）。失败返回 false。 */
export async function isStorefrontPhoto(
  imagePath: string,
  opts?: { model?: string },
): Promise<boolean> {
  try {
    const buf = await fs.promises.readFile(imagePath);
    const text = await ocrWithModel(
      opts?.model || "my-vl",
      STOREFRONT_PROMPT,
      buf.toString("base64"),
    );
    try {
      const obj = extractJsonObjectFromText(text || "") as { isStorefront?: unknown } | null;
      if (obj) {
        if (typeof obj?.isStorefront === "boolean") return obj.isStorefront;
        if (obj?.isStorefront === "true") return true;
        if (obj?.isStorefront === "false") return false;
      }
    } catch {
      /* 回退到关键字 */
    }
    const cleaned = (text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      const obj = JSON.parse(cleaned) as { isStorefront?: unknown };
      if (typeof obj?.isStorefront === "boolean") return obj.isStorefront;
      if (obj?.isStorefront === "true") return true;
      if (obj?.isStorefront === "false") return false;
    } catch {
      /* 回退到关键字 */
    }
    return /^\s*yes\b/i.test(text || "");
  } catch {
    return false;
  }
}

/**
 * 按 bbox 生成带 alpha 的蒙版 PNG：区域内 alpha=0（透明=重绘区），区域外
 * alpha=255（保留），边缘羽化。与 043 实测一致（LoadImage alpha → mask）。
 */
export async function generateInpaintMaskPng(
  inputImagePath: string,
  region: TextRegion,
  outPath: string,
  opts?: { featherPx?: number },
): Promise<{ width: number; height: number }> {
  const feather = Math.max(1, opts?.featherPx ?? 24);
  const { data, info } = await sharp(inputImagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const buf = Buffer.from(data);
  const x1 = Math.round((region.x1 / 100) * width);
  const x2 = Math.round((region.x2 / 100) * width);
  const y1 = Math.round((region.y1 / 100) * height);
  const y2 = Math.round((region.y2 / 100) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const aIdx = (y * width + x) * channels + 3;
      const dx = Math.max(x1 - x, 0, x - x2);
      const dy = Math.max(y1 - y, 0, y - y2);
      const dist = Math.max(dx, dy);
      if (dist <= 0) buf[aIdx] = 0;
      else if (dist >= feather) buf[aIdx] = 255;
      else buf[aIdx] = Math.round(255 * (dist / feather));
    }
  }
  await sharp(buf, { raw: { width, height, channels } }).png().toFile(outPath);
  return { width, height };
}

export interface BrandColorCheckResult {
  status: "passed" | "suspect" | "skipped";
  avgHex?: string;
  distances?: number[];
  reason?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return { r: 128, g: 128, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/**
 * 核色门：采样输出图（优先 bbox 区域）平均色，与品牌色板比对。
 * 启发式门禁（合理色差阈值内 passed）；解码/无色板 → skipped，不阻塞。
 */
export async function checkBrandColors(opts: {
  imageBase64: string;
  region?: TextRegion | null;
  palette: { hex: string; name?: string }[];
  threshold?: number;
}): Promise<BrandColorCheckResult> {
  const threshold = opts.threshold ?? 150;
  const palette = (opts.palette || []).map((p) => p.hex).filter(Boolean);
  if (palette.length === 0) return { status: "skipped", reason: "no_palette" };
  try {
    const buf = Buffer.from(stripDataUriPrefix(opts.imageBase64), "base64");
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const x1 = Math.round(((opts.region?.x1 ?? 0) / 100) * width);
    const x2 = Math.round(((opts.region?.x2 ?? 100) / 100) * width);
    const y1 = Math.round(((opts.region?.y1 ?? 0) / 100) * height);
    const y2 = Math.round(((opts.region?.y2 ?? 100) / 100) * height);
    let sumR = 0, sumG = 0, sumB = 0, n = 0;
    for (let y = Math.max(0, y1); y < Math.min(height, y2); y++) {
      for (let x = Math.max(0, x1); x < Math.min(width, x2); x++) {
        const idx = (y * width + x) * channels;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        n++;
      }
    }
    if (n === 0) return { status: "skipped", reason: "empty_region" };
    const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
    const avgHex = rgbToHex(avgR, avgG, avgB);
    const distances = palette.map((hex) => {
      const c = hexToRgb(hex);
      return Math.sqrt((avgR - c.r) ** 2 + (avgG - c.g) ** 2 + (avgB - c.b) ** 2);
    });
    const min = Math.min(...distances);
    return {
      status: min <= threshold ? "passed" : "suspect",
      avgHex,
      distances,
      reason: min <= threshold ? undefined : `min_distance=${min.toFixed(0)}>${threshold}`,
    };
  } catch {
    return { status: "skipped", reason: "decode_error" };
  }
}

/** 组装照片重绘提示词（文本替换版 + 品牌色重涂版）。纯函数可单测。 */
export function buildPhotoScenePrompts(opts: {
  brandName: string;
  brandColors?: { hex: string; name?: string }[];
}): { textPrompt: string; colorPrompt: string | null } {
  const name = opts.brandName || "品牌";
  const textPrompt =
    `把图片中墙面/招牌区域的现有文字替换为品牌招牌文字「${name}」，` +
    "现代简洁品牌风格，字体清晰端正，每个字只出现一次、无重复、无多余文字；" +
    "其余墙面、装饰、光线与结构保持不变。";
  const colors = (opts.brandColors || []).filter((c) => c && c.hex);
  if (colors.length === 0) return { textPrompt, colorPrompt: null };
  const colorDesc = colors
    .map((c, i) => (i === 0 ? `${c.name || "主色"}(${c.hex})为主色` : `${c.name || "点缀色"}(${c.hex})点缀`))
    .join("，");
  const colorPrompt =
    textPrompt +
    `同时把店内墙面、门头与陈设按品牌色板重新配色：${colorDesc}，整体温馨专业、统一和谐。`;
  return { textPrompt, colorPrompt };
}

const LOGO_HAS_TEXT_PROMPT =
  "请判断这张图片中是否存在任何文字（汉字/拼音/英文/数字）。只输出 JSON：" +
  '{"hasText":true或false,"text":"若存在则逐字列出全部文字，不存在则为空字符串"}。不要解释。';

/** 检测图片是否含可识别文字。用于“客户 logo 无文字（纯图形）”分支。 */
export async function detectLogoHasText(
  imageBase64: string,
  opts?: { model?: string },
): Promise<boolean> {
  try {
    const model = opts?.model || "my-vl";
    const ans = await ocrWithModel(model, LOGO_HAS_TEXT_PROMPT, imageBase64);
    try {
      const obj = extractJsonObjectFromText(ans || "") as { hasText?: unknown; text?: string } | null;
      if (typeof obj?.hasText === "boolean") return obj.hasText;
      if (obj?.hasText === "true") return true;
      if (obj?.hasText === "false") return false;
      if (typeof obj?.text === "string") {
        // text 字段给了逐字内容：有汉字或≥3 个连续字母才算有字
        const cn = (obj.text.match(/[\u4e00-\u9fff]/g) || []).length;
        const en = (obj.text.replace(/\s/g, "").match(/[A-Za-z]{3,}/g) || []).length;
        return cn > 0 || en > 0;
      }
    } catch {
      /* 走 OCR 兜底 */
    }
    const cleaned = (ans || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      const obj = JSON.parse(cleaned) as { hasText?: unknown; text?: string };
      if (typeof obj?.hasText === "boolean") return obj.hasText;
      if (obj?.hasText === "true") return true;
      if (obj?.hasText === "false") return false;
      if (typeof obj?.text === "string") {
        const cn = (obj.text.match(/[\u4e00-\u9fff]/g) || []).length;
        const en = (obj.text.replace(/\s/g, "").match(/[A-Za-z]{3,}/g) || []).length;
        return cn > 0 || en > 0;
      }
    } catch {
      /* 走 OCR 兜底 */
    }
    // 兜底：OCR 逐字提取；描述性散文（含常见词/空格）视为无字
    const text = await ocrWithModel(model, OCR_PROMPT, imageBase64);
    const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cn > 0) return true;
    const cleanedText = (text || "").replace(/[\s\p{P}\p{S}]/gu, "");
    if (cleanedText.length >= 3 && !/\b(the|image|logo|appears|provided|feature|design|stylized|emblem|this|that|with|you)\b/i.test(text || "")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
