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
  reason?: string;
  checkedAt?: string;
}

const OLLAMA_API = "http://127.0.0.1:11434";
const OCR_PROMPT =
  "请把图片里面所有可见的汉字、拼音、英文全部逐字完整提取出来，不要总结描述，只输出图片上出现的文字。";
const MASCOT_CHECK_PROMPT =
  '请评估这张3D卡通公仔图的完整性，只输出JSON：{"complete":true或false,"singleSubject":true或false,"whiteBackground":true或false,"noWatermark":true或false,"reason":"一句话"}。检查：1)主体是否完整（无缺肢、畸形、多肢体） 2)是否单主体居中 3)背景是否纯白 4)有无乱码或水印。';
const CLARITY_PROMPT =
  "请判断这张图片是否清晰、无乱码、无水印、无模糊。只回答：清晰 或 有问题。";

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
export async function runTextVisionCheck(opts: {
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
