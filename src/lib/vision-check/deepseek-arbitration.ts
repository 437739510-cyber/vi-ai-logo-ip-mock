/**
 * TICKET-122-R9：视觉门 DeepSeek 视觉仲裁通道。
 *
 * - 双通道（本地 qwen2.5vl + 免费在线）先判；不一致 / 空响应 / 解析失败时，
 *   用 DeepSeek 视觉模型 `deepseek-v4-flash-vision-exp` 终判。
 * - 消息格式：image_url 内联 data URL（实测有效）；Files API file_id 引用格式为
 *   `{"type":"file","file_id":"<id>"}`（purpose=user_data；image_url file:// 与
 *   file+file_data 均不被支持/不送图——TICKET-122-R9-R1 真实冒烟固化）。
 * - 费用：价格与 V4-Flash 一致；每次调用记录 token/费用/模型/finish_reason，
 *   通过 reporter 回调落盘（测试不写生产 Supabase）。
 */
import crypto from "node:crypto";
import sharp from "sharp";
import { calculateDeepSeekCost } from "../core/billing/deepseek-pricing";

export const DEEPSEEK_VISION_MODEL = "deepseek-v4-flash-vision-exp";
const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_FILES_URL = "https://api.deepseek.com/v1/files";
const ONLINE_SENSENOVA_URL = "https://token.sensenova.cn/v1/chat/completions";
const ONLINE_SILICONFLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";
const MAX_IMAGE_PX = 1280;

export type Transport = typeof fetch;

export interface DeepSeekVisionRecord {
  model: string;
  responseModel: string | null;
  httpStatus: number;
  finishReason: string | null;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costCny: number;
  latencyMs: number;
  fileId?: string | null;
  verdictKeys?: Record<string, unknown>;
}

export interface DeepSeekVisionResult {
  ok: boolean;
  raw: string;
  parsed: Record<string, unknown> | null;
  record: DeepSeekVisionRecord;
  reason?: string;
}

export interface OnlineVisionTextResult {
  ok: boolean;
  text?: string;
  reason?: string;
}

function stripDataUriPrefix(image: string): string {
  return String(image || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

async function resizeDataUrlToMax(imageBase64: string, maxPx = MAX_IMAGE_PX): Promise<string> {
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

export function parseVisionJson(raw: string): Record<string, unknown> | null {
  const cleaned = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function emptyRecord(): DeepSeekVisionRecord {
  return {
    model: DEEPSEEK_VISION_MODEL,
    responseModel: null,
    httpStatus: 0,
    finishReason: null,
    promptTokens: 0,
    cachedTokens: 0,
    completionTokens: 0,
    costCny: 0,
    latencyMs: 0,
    fileId: null,
  };
}

/**
 * DeepSeek 视觉判定（OpenAI 兼容，image_url 内联 data URL；transport 可注入用于
 * 离线 stub 测试；reporter 用于费用记录落盘，绝不写生产 Supabase）。
 */
export async function deepSeekVisionJudge(opts: {
  prompt: string;
  imageBase64?: string;
  fileId?: string;
  maxTokens?: number;
  transport?: Transport;
  reporter?: (record: DeepSeekVisionRecord) => void;
}): Promise<DeepSeekVisionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, raw: "", parsed: null, record: emptyRecord(), reason: "missing_key" };
  }
  const transport = opts.transport || fetch;
  const started = Date.now();
  const content: Array<Record<string, unknown>> = [{ type: "text", text: opts.prompt }];
  if (opts.fileId) {
    // TICKET-122-R9-R1 实测：DeepSeek 视觉文件引用格式为 {type:"file", file_id}
    // （image_url file:// 与 file+file_data 均不被支持/不送图）
    content.push({ type: "file", file_id: opts.fileId });
  } else if (opts.imageBase64) {
    const dataUrl = await resizeDataUrlToMax(opts.imageBase64);
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  } else {
    return { ok: false, raw: "", parsed: null, record: emptyRecord(), reason: "no_image" };
  }
  const record = emptyRecord();
  try {
    const response = await transport(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEEPSEEK_VISION_MODEL,
        messages: [{ role: "user", content }],
        temperature: 0,
        max_tokens: opts.maxTokens || 2048,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    record.httpStatus = response.status;
    const text = await response.clone().text();
    if (!response.ok) {
      record.latencyMs = Date.now() - started;
      return { ok: false, raw: text.slice(0, 400), parsed: null, record, reason: `http_${response.status}` };
    }
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep null */ }
    const choice = body?.choices?.[0];
    const raw = String(choice?.message?.content || "");
    record.responseModel = body?.model || null;
    record.finishReason = choice?.finish_reason || null;
    record.promptTokens = body?.usage?.prompt_tokens || 0;
    record.cachedTokens = body?.usage?.prompt_cache_hit_tokens || 0;
    record.completionTokens = body?.usage?.completion_tokens || 0;
    // 价格与 V4-Flash 一致（工单实测口径）；费用用 v4-flash 价表计算
    record.costCny = calculateDeepSeekCost("deepseek-v4-flash", {
      promptTokens: record.promptTokens,
      cachedPromptTokens: record.cachedTokens,
      completionTokens: record.completionTokens,
    }, new Date()).totalCostCny;
    record.latencyMs = Date.now() - started;
    const parsed = parseVisionJson(raw);
    if (!parsed) {
      return { ok: false, raw: raw.slice(0, 400), parsed: null, record, reason: "parse_failed" };
    }
    if (opts.reporter) opts.reporter(record);
    return { ok: true, raw, parsed, record };
  } catch (error) {
    record.latencyMs = Date.now() - started;
    return { ok: false, raw: "", parsed: null, record, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Files API 上传（expires_after 默认 24h；返回 file_id，测试后应删除）。 */
export async function deepSeekVisionUploadFile(
  imageBase64: string,
  opts: { transport?: Transport; expiresAfterHours?: number } = {},
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, error: "missing_key" };
  const transport = opts.transport || fetch;
  try {
    const buf = Buffer.from(stripDataUriPrefix(imageBase64), "base64");
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "image/png" }), "vision.png");
    // TICKET-122-R9-R1 实测：DeepSeek Files API 仅支持 purpose=user_data
    form.append("purpose", "user_data");
    form.append("model", DEEPSEEK_VISION_MODEL);
    form.append("expires_after", String((opts.expiresAfterHours || 24) * 3600));
    const response = await transport(DEEPSEEK_FILES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.clone().text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep null */ }
    if (!response.ok || !body?.id) return { ok: false, error: `http_${response.status}` };
    return { ok: true, fileId: String(body.id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Files API 删除（测试后清理）。 */
export async function deepSeekVisionDeleteFile(
  fileId: string,
  opts: { transport?: Transport } = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, error: "missing_key" };
  const transport = opts.transport || fetch;
  try {
    const response = await transport(`${DEEPSEEK_FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 免费线上视觉助手：SenseNova（OpenAI 兼容，失败不抛错）。 */
export async function sensenovaVisionText(
  prompt: string,
  imageBase64: string,
  opts: { transport?: Transport } = {},
): Promise<OnlineVisionTextResult> {
  const apiKey = process.env.SENSENOVA_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_key" };
  const transport = opts.transport || fetch;
  try {
    const dataUrl = await resizeDataUrlToMax(imageBase64);
    const response = await transport(ONLINE_SENSENOVA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sensenova-6.7-flash-lite",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
        max_tokens: 2048,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    const body = await response.json() as any;
    const raw = String(body?.choices?.[0]?.message?.content || "");
    if (!raw.trim()) return { ok: false, reason: "empty_response" };
    return { ok: true, text: raw };
  } catch (error) {
    return { ok: false, reason: `error:${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 免费线上视觉助手：SiliconFlow（OpenAI 兼容，失败不抛错）。 */
export async function siliconflowVisionText(
  prompt: string,
  imageBase64: string,
  opts: { transport?: Transport } = {},
): Promise<OnlineVisionTextResult> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_key" };
  const transport = opts.transport || fetch;
  try {
    const dataUrl = await resizeDataUrlToMax(imageBase64);
    const response = await transport(ONLINE_SILICONFLOW_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "Qwen/Qwen3-VL-8B-Instruct",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
        max_tokens: 2048,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    const body = await response.json() as any;
    const raw = String(body?.choices?.[0]?.message?.content || "");
    if (!raw.trim()) return { ok: false, reason: "empty_response" };
    return { ok: true, text: raw };
  } catch (error) {
    return { ok: false, reason: `error:${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 本地 Ollama 视觉（qwen2.5vl 直连，transport 可注入用于 stub）。 */
async function localOllamaVision(
  prompt: string,
  imageBase64: string,
  model: string,
  transport: Transport,
): Promise<string> {
  const response = await transport("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      images: [stripDataUriPrefix(imageBase64)],
      stream: false,
      keep_alive: "5m",
      options: { temperature: 0, num_predict: 800 },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) return "";
  const json = await response.json() as { response?: string };
  return String(json.response || "").trim();
}

export interface DualChannelOutcome {
  status: "passed" | "failed" | "skipped";
  source: "dual-consensus" | "deepseek-arbitration" | "unavailable";
  verdict: Record<string, unknown> | null;
  channels: Array<{ channel: string; raw: string; parsed: Record<string, unknown> | null; error?: string }>;
  deepseek?: DeepSeekVisionResult;
  records: DeepSeekVisionRecord[];
}

/**
 * 双通道 + DeepSeek 仲裁包装器。
 * - 本地 qwen2.5vl + 免费在线（默认 SenseNova）先判；
 * - 两通道对 verdictKeys 全部一致 → 双通道共识（不调用 DeepSeek）；
 * - 不一致 / 任一通道空响应或解析失败 → DeepSeek 视觉终判（allowDeepSeek=true 时）；
 * - 判定键均为布尔；passWhenAllTrue=true 时全部 true 才 passed。
 */
export async function runDualWithDeepSeekArbitration(opts: {
  prompt: string;
  imageBase64: string;
  verdictKeys: string[];
  passWhenAllTrue?: boolean;
  localModel?: string;
  onlineChannel?: "sensenova" | "siliconflow";
  transport?: Transport;
  reporter?: (record: DeepSeekVisionRecord) => void;
  allowDeepSeek?: boolean;
}): Promise<DualChannelOutcome> {
  const transport = opts.transport || fetch;
  const localModel = opts.localModel || "qwen2.5vl:latest";
  const onlineChannel = opts.onlineChannel || "sensenova";
  const passWhenAllTrue = opts.passWhenAllTrue !== false;
  const channels: DualChannelOutcome["channels"] = [];

  const localRaw = await localOllamaVision(opts.prompt, opts.imageBase64, localModel, transport);
  channels.push({ channel: `local:${localModel}`, raw: localRaw.slice(0, 300), parsed: parseVisionJson(localRaw) });
  const onlineFn = onlineChannel === "siliconflow" ? siliconflowVisionText : sensenovaVisionText;
  const onlineRes = await onlineFn(opts.prompt, opts.imageBase64, { transport });
  channels.push({ channel: onlineChannel, raw: (onlineRes.text || "").slice(0, 300), parsed: onlineRes.ok ? parseVisionJson(onlineRes.text || "") : null, error: onlineRes.ok ? undefined : onlineRes.reason });

  const localParsed = channels[0].parsed;
  const onlineParsed = channels[1].parsed;
  const agree = Boolean(localParsed && onlineParsed) &&
    opts.verdictKeys.every((k) => String(localParsed?.[k]) === String(onlineParsed?.[k]));

  const toStatus = (v: Record<string, unknown> | null): DualChannelOutcome["status"] => {
    if (!v) return "skipped";
    return passWhenAllTrue && opts.verdictKeys.every((k) => v[k] === true) ? "passed" : "failed";
  };

  if (agree) {
    return { status: toStatus(localParsed), source: "dual-consensus", verdict: localParsed, channels, records: [] };
  }

  if (opts.allowDeepSeek === false) {
    return { status: "skipped", source: "unavailable", verdict: null, channels, records: [] };
  }

  const deepseek = await deepSeekVisionJudge({ prompt: opts.prompt, imageBase64: opts.imageBase64, transport, reporter: opts.reporter });
  const outcome: DualChannelOutcome = {
    status: deepseek.ok ? toStatus(deepseek.parsed) : "skipped",
    source: deepseek.ok ? "deepseek-arbitration" : "unavailable",
    verdict: deepseek.ok ? deepseek.parsed : null,
    channels,
    deepseek,
    records: deepseek.ok ? [deepseek.record] : [],
  };
  return outcome;
}

/**
 * TICKET-122-R9-R1：worker 视觉门接线助手。
 * - 仅当 `enabled`（缺省=环境变量 VISION_ARBITRATION_ENABLED==="1"）时执行；
 * - 双通道不一致/空响应/解析失败时由 runDualWithDeepSeekArbitration 仲裁；
 * - 仲裁不可用（禁用/异常）返回 { arbitrated:false }，调用方必须沿用既有多数制
 *   判定并在记录中标注「仲裁不可用」，绝不因仲裁失败静默放行。
 */
export async function maybeArbitrateVision(opts: {
  imageBase64: string;
  prompt: string;
  verdictKeys: string[];
  enabled?: boolean;
  transport?: Transport;
  reporter?: (record: DeepSeekVisionRecord) => void;
}): Promise<{ arbitrated: boolean; reason?: string; outcome?: DualChannelOutcome }> {
  const enabled = opts.enabled ?? process.env.VISION_ARBITRATION_ENABLED === "1";
  if (!enabled) return { arbitrated: false, reason: "disabled" };
  try {
    const outcome = await runDualWithDeepSeekArbitration({
      prompt: opts.prompt,
      imageBase64: opts.imageBase64,
      verdictKeys: opts.verdictKeys,
      transport: opts.transport,
      reporter: opts.reporter,
      allowDeepSeek: true,
    });
    return { arbitrated: true, outcome };
  } catch (error) {
    return { arbitrated: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** 小工具：输出 sha256（供测试断言用）。 */
export function sha256Text(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
