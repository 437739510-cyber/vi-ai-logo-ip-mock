/**
 * IP Image Provider Layer — ComfyUI Provider (Z-Image Turbo GGUF)
 *
 * Local image generation via ComfyUI REST API (http://127.0.0.1:8188).
 * Uses Z-Image Turbo nvfp4 (z_image_turbo_nvfp4.safetensors) with UNETLoader pipeline.
 * Chinese text quality: 90/100 (ARK doubao-vision verified).
 *
 * Startup: python main.py --gpu-only --lowvram --port 8188
 */

import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";

// ========== Constants ==========

const COMFYUI_BASE = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
// 整改：原 120s 硬超时会在 ComfyUI(~150s 才完成) 跑到一半时丢弃 logo/场景图。
// 改为按 prompt_id 轮询 /history 直到该 prompt 完成再返回。
// 工单 030：单张生成超时放宽到 600s（本机单张 20s~300s 波动，首图含模型装载）。
// 工单 049：不再死等 600s——poll 期间检测「无进度」主动断开：
//   - prompt 不在 /queue 且 /history 无结果持续 NO_PROGRESS_TIMEOUT_MS → NO_PROGRESS（retryable）
//   - ComfyUI API 连续 POLL_UNREACHABLE_LIMIT 次轮询失败 → COMFYUI_UNREACHABLE（retryable）
const TIMEOUT_MS = 600_000; // 总体硬上限（兜底）
const NO_PROGRESS_TIMEOUT_MS = Number(process.env.COMFYUI_NO_PROGRESS_TIMEOUT_MS) || 150_000;
const POLL_UNREACHABLE_LIMIT = 5; // 每 POLL_INTERVAL_MS 一次，约 10s 连续失败视为不可达
const POLL_INTERVAL_MS = Number(process.env.COMFYUI_POLL_INTERVAL_MS) || 2_000;

export interface ComfyRequestDeps {
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  nowImpl?: () => number;
  baseUrl?: string;
  randomIdImpl?: () => string;
}

export interface ComfyWorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export interface ReferenceAnchorWorkflowOptions {
  prompt: string;
  referenceImageName: string;
  seed?: number;
  steps?: number;
  width?: number;
  height?: number;
  filenamePrefix?: string;
  unetName?: string;
  clipName?: string;
  vaeName?: string;
}

// ========== Z-Image Turbo GGUF Workflow ==========

/**
 * Build Z-Image Turbo GGUF workflow for ComfyUI API.
 *
 * Pipeline: UNETLoader → CLIPLoader → VAELoader →
 *   CLIPTextEncode(pos) → CLIPTextEncode(neg) →
 *   BasicGuider ← model + pos → BasicScheduler ← model →
 *   KSamplerSelect(euler) → RandomNoise →
 *   SamplerCustomAdvanced(noise, guider, sampler, sigmas, latent) →
 *   VAEDecode → SaveImage
 *
 * Model files (must exist in ComfyUI models/ dirs):
 *   diffusion_models/z_image_turbo_nvfp4.safetensors
 *   text_encoders/qwen_3_4b_fp8_mixed.safetensors
 *   vae/ae.safetensors
 */
function buildZTWorkflow(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  seed: number,
  mode: "chinese" | "pinyin" = "chinese"
): Record<string, any> {
  return {
    "1": {
      // 工单 024：拼音模式用 Q4_K_M GGUF（成功案例 comfyui_zt_00366~00370），中文模式用 nvfp4
      ...(mode === "pinyin"
        ? { class_type: "UnetLoaderGGUF", inputs: { unet_name: "z-image-turbo-Q4_K_M.gguf" } }
        : { class_type: "UNETLoader", inputs: { unet_name: "z_image_turbo_nvfp4.safetensors", weight_dtype: "default" } }),
    },
    "2": {
      class_type: "CLIPLoader",
      inputs: {
        clip_name: "qwen_3_4b_fp8_mixed.safetensors",
        type: "qwen_image",
      },
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: "ae.safetensors" },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["2", 0] },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, distorted", clip: ["2", 0] },
    },
    "6": {
      class_type: "BasicGuider",
      inputs: { model: ["1", 0], conditioning: ["4", 0] },
    },
    "7": {
      class_type: "BasicScheduler",
      inputs: { model: ["1", 0], scheduler: "simple", steps: 4, denoise: 1.0 },
    },
    "8": {
      class_type: "KSamplerSelect",
      inputs: { sampler_name: "euler" },
    },
    "9": {
      class_type: "RandomNoise",
      inputs: { noise_seed: seed },
    },
    "10": {
      class_type: "EmptySD3LatentImage",
      inputs: { width: roundTo8(width), height: roundTo8(height), batch_size: 1 },
    },
    "11": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["9", 0],
        guider: ["6", 0],
        sampler: ["8", 0],
        sigmas: ["7", 0],
        latent_image: ["10", 0],
      },
    },
    "12": {
      class_type: "VAEDecode",
      inputs: { samples: ["11", 0], vae: ["3", 0] },
    },
    "13": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui_zt", images: ["12", 0] },
    },
  };
}

// ========== Error Types ==========

export class ComfyUIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ComfyUIError";
  }
}

// ========== Helpers ==========

function roundTo8(n: number): number {
  return Math.max(64, Math.round(n / 8) * 8);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function boundedInt(value: number | undefined, fallback: number, min: number, max: number, label: string): number {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual < min || actual > max) {
    throw new ComfyUIError(`${label} must be an integer between ${min} and ${max}`, "REFERENCE_INVALID_CONFIG", false);
  }
  return actual;
}

/** 工单 073：Flux2 Klein 双图参考锚定工作流纯构建器。 */
export function buildReferenceAnchorWorkflow(options: ReferenceAnchorWorkflowOptions): ComfyWorkflow {
  const seed = boundedInt(options.seed, 73_001, 0, Number.MAX_SAFE_INTEGER, "seed");
  const steps = boundedInt(options.steps, 20, 4, 50, "steps");
  const width = roundTo8(boundedInt(options.width, 1024, 512, 2048, "width"));
  const height = roundTo8(boundedInt(options.height, 1024, 512, 2048, "height"));
  const prefix = options.filenamePrefix || "bb_ref_anchor";
  if (!/^[A-Za-z0-9_-]+$/.test(prefix)) {
    throw new ComfyUIError("filenamePrefix must contain ASCII letters, digits, underscore or hyphen only", "REFERENCE_INVALID_CONFIG", false);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(options.referenceImageName)) {
    throw new ComfyUIError("referenceImageName must be a safe ASCII filename", "REFERENCE_INVALID_CONFIG", false);
  }
  const scenePrompt = [
    options.prompt,
    "complete professional commercial scene with a clearly visible environment and structural context",
    "wide or medium-wide composition, the environment remains the dominant scene",
    "integrate the reference logo naturally on the specified physical carrier",
    "preserve the reference logo silhouette and key graphic elements",
    "matching perspective, material, reflections, shadows and ambient lighting",
    "not an isolated logo, not a logo close-up, not a floating graphic, not an empty background",
  ].join(", ");
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: options.unetName || "Flux2-Klein-9B-True-v2-nvfp4mixed.safetensors", weight_dtype: "default" } },
    "2": { class_type: "CLIPLoader", inputs: { clip_name: options.clipName || "qwen_3_8b_fp8mixed.safetensors", type: "flux2" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: options.vaeName || "flux2-vae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: scenePrompt } },
    "5": { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
    "6": { class_type: "FluxKontextMultiReferenceLatentMethod", inputs: { conditioning: ["4", 0], reference_latents_method: "offset" } },
    "7": { class_type: "EmptyFlux2LatentImage", inputs: { width, height, batch_size: 1 } },
    "8": { class_type: "LoadImage", inputs: { image: options.referenceImageName } },
    "9": { class_type: "FluxKontextImageScale", inputs: { image: ["8", 0] } },
    "10": { class_type: "VAEEncode", inputs: { pixels: ["9", 0], vae: ["3", 0] } },
    "11": { class_type: "ReferenceLatent", inputs: { conditioning: ["6", 0], latent: ["10", 0] } },
    "12": { class_type: "Flux2Scheduler", inputs: { steps, width, height } },
    "13": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "14": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "15": { class_type: "CFGGuider", inputs: { model: ["1", 0], positive: ["11", 0], negative: ["5", 0], cfg: 3.5 } },
    "16": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["14", 0], guider: ["15", 0], sampler: ["13", 0], sigmas: ["12", 0], latent_image: ["7", 0] } },
    "17": { class_type: "VAEDecode", inputs: { samples: ["16", 0], vae: ["3", 0] } },
    "18": { class_type: "SaveImage", inputs: { filename_prefix: prefix, images: ["17", 0] } },
  };
}

/**
 * 工单 049：兼容两种 /queue 条目格式——
 *   - 旧版对象：{ prompt_id, number, ... }
 *   - ComfyUI 0.26+ 数组：[number, prompt_id, prompt, extra_data, outputs]
 */
function queueItemPromptId(item: unknown): string | undefined {
  if (Array.isArray(item)) return typeof item[1] === "string" ? item[1] : undefined;
  if (item && typeof item === "object") {
    return (item as { prompt_id?: unknown }).prompt_id as string | undefined;
  }
  return undefined;
}

async function submitAndWait(
  workflow: Record<string, any>,
  timeoutMs: number = TIMEOUT_MS,
  deps: ComfyRequestDeps = {},
): Promise<{ filename: string; durationMs: number; promptId: string }> {
  const fetchImpl = deps.fetchImpl || fetch;
  const sleepImpl = deps.sleepImpl || sleep;
  const nowImpl = deps.nowImpl || Date.now;
  const baseUrl = deps.baseUrl || COMFYUI_BASE;
  const startTime = nowImpl();

  // Submit
  const promptResponse = await fetchImpl(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!promptResponse.ok) {
    const errText = await promptResponse.text();
    throw new ComfyUIError(
      `ComfyUI queue error ${promptResponse.status}: ${errText.slice(0, 300)}`,
      "QUEUE_ERROR",
      true
    );
  }

  const promptData = await promptResponse.json();
  const promptId = promptData.prompt_id;
  if (!promptId) {
    throw new ComfyUIError("No prompt_id in response", "NO_PROMPT_ID", true);
  }

  // Poll
  let filename: string | null = null;
  let error: string | null = null;
  // 工单 049：无进度检测——最后一次在 /queue 看到该 prompt 的时刻；从未入队则用提交时刻
  let lastSeenInQueueAt = startTime;
  let pollFailCount = 0;

  const interruptBestEffort = async () => {
    try {
      await fetchImpl(`${baseUrl}/interrupt`, {
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // best effort
    }
  };

  while (nowImpl() - startTime < timeoutMs) {
    await sleepImpl(POLL_INTERVAL_MS);

    // 进度源 1：/queue 是否仍持有该 prompt（有动静=执行中/排队中）
    try {
      const queueResp = await fetchImpl(`${baseUrl}/queue`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (queueResp.ok) {
        pollFailCount = 0;
        const queueData = await queueResp.json();
        const running = queueData?.queue_running || [];
        const pending = queueData?.queue_pending || [];
        if ([...running, ...pending].some((it) => queueItemPromptId(it) === promptId)) {
          lastSeenInQueueAt = nowImpl();
        }
      } else {
        pollFailCount += 1;
      }
    } catch {
      pollFailCount += 1;
    }

    if (pollFailCount >= POLL_UNREACHABLE_LIMIT) {
      await interruptBestEffort();
      throw new ComfyUIError(
        `ComfyUI API unreachable for ${POLL_UNREACHABLE_LIMIT} consecutive polls during generation`,
        "COMFYUI_UNREACHABLE",
        true
      );
    }

    // 无进度判定：prompt 已不在队列且 /history 无结果（被丢弃/崩溃/从未入队）→ 主动断开
    if (nowImpl() - lastSeenInQueueAt >= NO_PROGRESS_TIMEOUT_MS) {
      await interruptBestEffort();
      throw new ComfyUIError(
        `No progress for ${NO_PROGRESS_TIMEOUT_MS}ms (prompt not in queue, no output)`,
        "NO_PROGRESS",
        true
      );
    }

    // 进度源 2：/history 是否已有输出
    try {
      const histResp = await fetchImpl(`${baseUrl}/history/${promptId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (histResp.status === 404) continue;
      if (!histResp.ok) continue;

      const histData = await histResp.json();
      const result = histData[promptId];
      if (!result) continue;

      if (result.status?.status_str === "error") {
        error = result.status?.reason || "Unknown ComfyUI error";
        break;
      }

      if (result.outputs) {
        // Look for images in any output node
        for (const nid of Object.keys(result.outputs)) {
          const images = result.outputs[nid]?.images;
          if (images?.[0]?.filename) {
            filename = images[0].filename;
            break;
          }
        }
        if (filename) break;
      }

      if (result.status?.completed === true && !filename) {
        error = "Completed but no image in output";
        break;
      }
    } catch {
      // polling error, continue
    }
  }

  if (error) throw new ComfyUIError(`Generation error: ${error}`, "GEN_ERROR", true);
  if (!filename) throw new ComfyUIError(`Timed out after ${timeoutMs}ms`, "TIMEOUT", true);

  // 2026-08-03 Chris 决策：已更换新内存条，默认取消 45 秒间隔（提速）；
  // 若日后再次出现蓝屏/不稳定，设 COMFYUI_COOLDOWN_MS=45000 即可恢复保护。
  const COOLDOWN_MS = Number(process.env.COMFYUI_COOLDOWN_MS) || 0;
  if (COOLDOWN_MS > 0) await sleepImpl(COOLDOWN_MS);

  return { filename, durationMs: nowImpl() - startTime, promptId };
}

async function readImageAsBase64(filename: string, deps: ComfyRequestDeps = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl || fetch;
  const sleepImpl = deps.sleepImpl || sleep;
  const baseUrl = deps.baseUrl || COMFYUI_BASE;
  const viewUrl = `${baseUrl}/view?filename=${encodeURIComponent(filename)}&type=output`;
  const safeFilename = filename.replace(/[^A-Za-z0-9._/-]/g, "_").slice(0, 160) || "unknown";
  const maxAttempts = 3;
  let lastSummary = "unknown error";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const resp = await fetchImpl(viewUrl, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) {
        lastSummary = `HTTP ${resp.status}`;
        const transientStatus = [408, 425, 429].includes(resp.status) || resp.status >= 500;
        if (!transientStatus) {
          throw new ComfyUIError(
            `Output fetch failed for ${safeFilename} after ${attempt} attempt(s): ${lastSummary}`,
            "OUTPUT_FETCH_FAILED",
            false,
          );
        }
      } else {
        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.length === 0) {
          throw new ComfyUIError(
            `Output fetch failed for ${safeFilename} after ${attempt} attempt(s): empty response`,
            "OUTPUT_FETCH_FAILED",
            true,
          );
        }
        return "data:image/png;base64," + buffer.toString("base64");
      }
    } catch (error) {
      if (error instanceof ComfyUIError) throw error;
      const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
      const transientNetwork = /abort|timeout|network|fetch failed|socket|connect|reset/i.test(message);
      if (!transientNetwork) {
        throw new ComfyUIError(
          `Output fetch failed for ${safeFilename} after ${attempt} attempt(s): network error`,
          "OUTPUT_FETCH_FAILED",
          false,
        );
      }
      lastSummary = /abort|timeout/i.test(message) ? "request timeout" : "network error";
    }

    if (attempt < maxAttempts) await sleepImpl(2_000);
  }

  throw new ComfyUIError(
    `Output fetch failed for ${safeFilename} after ${maxAttempts} attempt(s): ${lastSummary}`,
    "OUTPUT_FETCH_FAILED",
    true,
  );
}

function decodeReferenceImage(input: Buffer | string): { bytes: Buffer; mimeType: string } {
  if (Buffer.isBuffer(input)) return { bytes: input, mimeType: "image/png" };
  const value = input.trim();
  const dataUri = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  const bytes = Buffer.from(dataUri ? dataUri[2] : value, "base64");
  if (bytes.length === 0) {
    throw new ComfyUIError("Reference image is empty", "REFERENCE_UPLOAD_FAILED", false);
  }
  return { bytes, mimeType: dataUri?.[1] || "image/png" };
}

async function uploadReferenceImage(
  input: Buffer | string,
  deps: ComfyRequestDeps,
): Promise<string> {
  const fetchImpl = deps.fetchImpl || fetch;
  const baseUrl = deps.baseUrl || COMFYUI_BASE;
  const randomId = (deps.randomIdImpl?.() || Math.random().toString(36).slice(2, 12))
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 32) || "ref";
  const filename = `bb-ref-${randomId}.png`;
  const { bytes, mimeType } = decodeReferenceImage(input);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes)], { type: mimeType }), filename);
  form.append("type", "input");
  form.append("overwrite", "true");
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/upload/image`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new ComfyUIError(`Reference upload failed: ${(error as Error).message}`, "REFERENCE_UPLOAD_FAILED", true);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new ComfyUIError(`Reference upload failed (${response.status}): ${detail}`, "REFERENCE_UPLOAD_FAILED", true);
  }
  const payload = await response.json() as { name?: unknown; subfolder?: unknown };
  if (typeof payload.name !== "string" || !payload.name) {
    throw new ComfyUIError("Reference upload response has no image name", "REFERENCE_UPLOAD_FAILED", true);
  }
  const subfolder = typeof payload.subfolder === "string" ? payload.subfolder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") : "";
  return subfolder ? `${subfolder}/${payload.name}` : payload.name;
}

function mapReferenceExecutorError(error: unknown): ComfyUIError {
  if (error instanceof ComfyUIError && error.code.startsWith("REFERENCE_")) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/class_type|node.+(?:missing|not found|does not exist)|FluxKontext|ReferenceLatent/i.test(message)) {
    return new ComfyUIError(message, "REFERENCE_NODE_MISSING", false);
  }
  if (/unet_name|clip_name|vae_name|model.+(?:missing|not found)|not in list/i.test(message)) {
    return new ComfyUIError(message, "REFERENCE_MODEL_MISSING", false);
  }
  const code = error instanceof ComfyUIError ? error.code : "";
  if (code === "TIMEOUT" || code === "NO_PROGRESS") {
    return new ComfyUIError(message, "REFERENCE_TIMEOUT", true);
  }
  if (code === "QUEUE_ERROR" || code === "NO_PROMPT_ID") {
    return new ComfyUIError(message, "REFERENCE_SUBMIT_FAILED", true);
  }
  if (code === "OUTPUT_FETCH_FAILED") {
    return new ComfyUIError(message, "REFERENCE_OUTPUT_FETCH_FAILED", error instanceof ComfyUIError && error.retryable);
  }
  if (code === "FILE_NOT_FOUND" || (code === "GEN_ERROR" && /no image|no output/i.test(message))) {
    return new ComfyUIError(message, "REFERENCE_NO_OUTPUT", false);
  }
  return new ComfyUIError(message, "REFERENCE_POLL_FAILED", true);
}

// ========== Provider ==========

export class ComfyUIProvider implements ImageProvider {
  name = "comfyui";

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(COMFYUI_BASE, {
        signal: AbortSignal.timeout(3_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    if (!(await this.isAvailable())) {
      throw new ComfyUIError("ComfyUI not running", "NOT_AVAILABLE", false);
    }

    const seed = Math.floor(Math.random() * 2_147_483_647);
    const width = params.output?.width || 1024;
    const height = params.output?.height || 1024;

    const workflow = buildZTWorkflow(
      params.prompt,
      params.negativePrompt || "",
      width,
      height,
      seed
    );

    const { filename, durationMs } = await submitAndWait(workflow);
    const imageUrl = await readImageAsBase64(filename);

    return {
      imageUrl,
      actualCost: 0,
      durationMs,
      assetId: `comfyui-zt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerName: "comfyui",
      providerMeta: {
        model: "z_image_turbo_nvfp4",
        width,
        height,
        seed,
        steps: 4,
        sampler: "euler",
        scheduler: "simple",
      },
    };
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    return this.generateImage({
      ...params,
      step: { ...params.step, stepId: params.step.stepId + "-variant" },
    });
  }
}

// ========== Standalone API (called by worker.mjs) ==========

export async function comfyGenerateLogo(options: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  mode?: "chinese" | "pinyin";
  seed?: number;
}, deps: ComfyRequestDeps = {}): Promise<{ imageUrl: string; durationMs: number; model: string; source: string; seed?: number }> {
  const size = parseSize(options.size || "1024x1024");
  const mode = options.mode === "pinyin" ? "pinyin" : "chinese";
  // 工单 027：支持外部指定 seed（校验不合格重试时换 seed 重新生成）。
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const logoNeg = options.negativePrompt ||
    "blurry, low quality, distorted text, photorealistic, 3d render, shadows, messy, watermark";

  // Try Z-Image Turbo locally first
  try {
    const workflow = buildZTWorkflow(options.prompt, logoNeg, size.width, size.height, seed, mode);
    const { filename, durationMs } = await submitAndWait(workflow, TIMEOUT_MS, deps);
    const imageUrl = await readImageAsBase64(filename, deps);
    return { imageUrl, durationMs, model: mode === "pinyin" ? "z-image-turbo-Q4_K_M" : "z_image_turbo_nvfp4", source: "local", seed };
  } catch (ztErr) {
    console.warn("[comfyui] Local Logo generation failed; rethrowing local error");
    throw ztErr;
  }
}

/** 工单 073：仅走本地 Flux2 Klein reference-anchor，不允许降级到 ARK/普通文生图。 */
export async function comfyGenerateReferenceAnchor(options: {
  prompt: string;
  referenceImage: Buffer | string;
  seed?: number;
  steps?: number;
  width?: number;
  height?: number;
  timeoutMs?: number;
}, deps: ComfyRequestDeps = {}): Promise<{
  imageUrl: string;
  durationMs: number;
  model: string;
  source: "local";
  seed: number;
  strategy: "reference_anchor";
  executorStatus: "candidate_074";
  diagnostics: { referenceUploadName: string; promptId: string; workflowNodeCount: number };
}> {
  const seed = boundedInt(options.seed, 73_001, 0, Number.MAX_SAFE_INTEGER, "seed");
  let referenceUploadName: string;
  try {
    referenceUploadName = await uploadReferenceImage(options.referenceImage, deps);
  } catch (error) {
    throw mapReferenceExecutorError(error);
  }
  const workflow = buildReferenceAnchorWorkflow({
    prompt: options.prompt,
    referenceImageName: referenceUploadName,
    seed,
    steps: options.steps,
    width: options.width,
    height: options.height,
  });
  try {
    const { filename, durationMs, promptId } = await submitAndWait(workflow, options.timeoutMs, deps);
    const imageUrl = await readImageAsBase64(filename, deps);
    return {
      imageUrl,
      durationMs,
      model: "Flux2-Klein-9B-True-v2-nvfp4mixed",
      source: "local",
      seed,
      strategy: "reference_anchor",
      executorStatus: "candidate_074",
      diagnostics: { referenceUploadName, promptId, workflowNodeCount: Object.keys(workflow).length },
    };
  } catch (error) {
    throw mapReferenceExecutorError(error);
  }
}

/** 073 composite fallback 专用本地无字底图；失败直接抛出，绝不进入付费云回退。 */
export async function comfyGenerateCompositeBackground(options: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  seed?: number;
}): Promise<{ imageUrl: string; durationMs: number; model: string; source: "local"; seed: number }> {
  const size = parseSize(options.size || "1024x1024");
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const workflow = buildZTWorkflow(
    options.prompt,
    options.negativePrompt || "logo, text, letters, watermark, blurry, low quality, distorted",
    size.width,
    size.height,
    seed,
  );
  const { filename, durationMs } = await submitAndWait(workflow);
  const imageUrl = await readImageAsBase64(filename);
  return { imageUrl, durationMs, model: "z_image_turbo_nvfp4", source: "local", seed };
}

export async function comfyGenerateScene(options: {
  prompt: string;
  refImageUrl?: string;
  negativePrompt?: string;
  size?: string;
}, deps: ComfyRequestDeps = {}): Promise<{ imageUrl: string; durationMs: number; model: string; source: string }> {
  const size = parseSize(options.size || "1024x1024");
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const sceneNeg = options.negativePrompt ||
    "blurry, low quality, distorted, deformed, ugly, watermark, text errors, bad typography";

  // Try Z-Image Turbo locally first
  try {
    const workflow = buildZTWorkflow(options.prompt, sceneNeg, size.width, size.height, seed);
    const { filename, durationMs } = await submitAndWait(workflow, TIMEOUT_MS, deps);
    const imageUrl = await readImageAsBase64(filename, deps);
    return { imageUrl, durationMs, model: "z_image_turbo_nvfp4", source: "local" };
  } catch (ztErr) {
    console.warn("[comfyui] Local Scene generation failed; rethrowing local error");
    throw ztErr;
  }
}

/**
 * 工单 044：门店照片→场景图（T2 蒙版局部重绘主路，043 实测参数）。
 * 输入：已放在 ComfyUI input 目录的带 alpha PNG（透明区=重绘区）。
 * 工作流：UNETLoader(nvfp4)/UnetLoaderGGUF(Q4) → CLIPLoader(qwen_image) →
 *   VAELoader(ae) → LoadImage(alpha) → VAEEncodeForInpaint(grow_mask_by=6) →
 *   SamplerCustomAdvanced(euler/simple/steps=4/denoise=1.0) → VAEDecode → SaveImage
 */
export async function comfyuiInpaintPhoto(options: {
  imageFile: string; // ComfyUI input 目录下的文件名（由调用方写入）
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  variant?: "nvfp4" | "q4";
  filenamePrefix?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string; seed: number }> {
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const variant = options.variant === "q4" ? "q4" : "nvfp4";
  const neg = options.negativePrompt || "blurry, low quality, distorted, watermark, text errors, bad typography";
  const workflow: Record<string, any> = {
    "1": variant === "q4"
      ? { class_type: "UnetLoaderGGUF", inputs: { unet_name: "z-image-turbo-Q4_K_M.gguf" } }
      : { class_type: "UNETLoader", inputs: { unet_name: "z_image_turbo_nvfp4.safetensors", weight_dtype: "default" } },
    "2": {
      class_type: "CLIPLoader",
      inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "qwen_image" },
    },
    "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: options.prompt, clip: ["2", 0] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: neg, clip: ["2", 0] } },
    "6": { class_type: "LoadImage", inputs: { image: options.imageFile } },
    "7": {
      class_type: "VAEEncodeForInpaint",
      inputs: { pixels: ["6", 0], vae: ["3", 0], mask: ["6", 1], grow_mask_by: 6 },
    },
    "8": { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: ["4", 0] } },
    "9": { class_type: "BasicScheduler", inputs: { model: ["1", 0], scheduler: "simple", steps: 4, denoise: 1.0 } },
    "10": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "11": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "12": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["11", 0],
        guider: ["8", 0],
        sampler: ["10", 0],
        sigmas: ["9", 0],
        latent_image: ["7", 0],
      },
    },
    "13": { class_type: "VAEDecode", inputs: { samples: ["12", 0], vae: ["3", 0] } },
    "14": {
      class_type: "SaveImage",
      inputs: { filename_prefix: options.filenamePrefix || "comfyui_zt_inpaint", images: ["13", 0] },
    },
  };
  const { filename, durationMs } = await submitAndWait(workflow);
  const imageUrl = await readImageAsBase64(filename);
  return {
    imageUrl,
    durationMs,
    model: variant === "q4" ? "z-image-turbo-Q4_K_M" : "z_image_turbo_nvfp4",
    seed,
  };
}

// ========== Aliases (route compatibility) ==========

export const comfyuiGenerateLogo = comfyGenerateLogo;
export const comfyuiGenerateScene = comfyGenerateScene;
export const comfyGenerateImage = async (options: {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}) => {
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const wf = buildZTWorkflow(
    options.prompt,
    options.negativePrompt || "",
    options.width || 1024,
    options.height || 1024,
    seed
  );
  const { filename, durationMs } = await submitAndWait(wf, TIMEOUT_MS);
  const imageUrl = await readImageAsBase64(filename);
  return { imageUrl, durationMs };
};

export async function isComfyUIAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(COMFYUI_BASE, {
      signal: AbortSignal.timeout(3_000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function comfyGenerateFromWorkflow(
  workflow: Record<string, any>,
  options?: { timeoutMs?: number }
): Promise<{ imageUrl: string; durationMs: number }> {
  const { filename, durationMs } = await submitAndWait(
    workflow,
    options?.timeoutMs
  );
  const imageUrl = await readImageAsBase64(filename);
  return { imageUrl, durationMs };
}

// ========== Helpers ==========

function parseSize(sizeStr: string): { width: number; height: number } {
  const parts = sizeStr.toLowerCase().split("x");
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && !isNaN(h)) return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}

