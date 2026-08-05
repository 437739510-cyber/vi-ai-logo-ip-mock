/**
 * IP Image Provider Layer — ComfyUI Provider (Z-Image Turbo GGUF)
 *
 * Local image generation via ComfyUI REST API (http://127.0.0.1:8188).
 * Uses Z-Image Turbo nvfp4 (z_image_turbo_nvfp4.safetensors) with UNETLoader pipeline.
 * Chinese text quality: 90/100 (ARK doubao-vision verified).
 *
 * Startup: python main.py --gpu-only --lowvram --port 8188
 */

import { arkGenerate } from './ark-fallback';
import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";

// ========== Constants ==========

const COMFYUI_BASE = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const PROMPT_URL = `${COMFYUI_BASE}/prompt`;
const HISTORY_URL = `${COMFYUI_BASE}/history`;
// 整改：原 120s 硬超时会在 ComfyUI(~150s 才完成) 跑到一半时丢弃 logo/场景图。
// 改为按 prompt_id 轮询 /history 直到该 prompt 完成再返回。
// 工单 030：单张生成超时放宽到 600s（本机单张 20s~300s 波动，首图含模型装载）。
const TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 2_000;

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

async function submitAndWait(
  workflow: Record<string, any>,
  timeoutMs: number = TIMEOUT_MS
): Promise<{ filename: string; durationMs: number }> {
  const startTime = Date.now();

  // Submit
  const promptResponse = await fetch(PROMPT_URL, {
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

  while (Date.now() - startTime < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const histResp = await fetch(`${HISTORY_URL}/${promptId}`, {
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
  if (COOLDOWN_MS > 0) await sleep(COOLDOWN_MS);

  return { filename, durationMs: Date.now() - startTime };
}

async function readImageAsBase64(filename: string): Promise<string> {
  const viewUrl = `${COMFYUI_BASE}/view?filename=${encodeURIComponent(filename)}&type=output`;
  const resp = await fetch(viewUrl, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) {
    throw new ComfyUIError(
      `Image not found: ${filename} (${resp.status})`,
      "FILE_NOT_FOUND",
      false
    );
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  return "data:image/png;base64," + buffer.toString("base64");
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
}): Promise<{ imageUrl: string; durationMs: number; model: string; source: string; seed?: number }> {
  const size = parseSize(options.size || "1024x1024");
  const mode = options.mode === "pinyin" ? "pinyin" : "chinese";
  // 工单 027：支持外部指定 seed（校验不合格重试时换 seed 重新生成）。
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const logoNeg = options.negativePrompt ||
    "blurry, low quality, distorted text, photorealistic, 3d render, shadows, messy, watermark";

  // Try Z-Image Turbo locally first
  try {
    const workflow = buildZTWorkflow(options.prompt, logoNeg, size.width, size.height, seed, mode);
    const { filename, durationMs } = await submitAndWait(workflow);
    const imageUrl = await readImageAsBase64(filename);
    return { imageUrl, durationMs, model: mode === "pinyin" ? "z-image-turbo-Q4_K_M" : "z_image_turbo_nvfp4", source: "local", seed };
  } catch (ztErr) {
    // 部署红线（Chris 2026-08-03）：生图必须本地完成，禁止回退到付费 ARK。
    const arkDisabled = (process.env.COMFYUI_DISABLE_ARK_FALLBACK || "").trim() === "1";
    // 工单 030：日志文案修正——禁用回退时不再误导为“falling back to ARK”。
    console.warn(`[comfyui] Z-Image Turbo failed, ${arkDisabled ? "ARK fallback disabled, rethrowing" : "falling back to ARK"}:`, (ztErr as Error).message.slice(0, 100));
    if (arkDisabled) throw ztErr;
  }

  // Fallback to ARK cloud
  const arkResult = await arkGenerate(options.prompt, logoNeg, size.width, size.height);
  return { imageUrl: arkResult.imageUrl, durationMs: 0, model: arkResult.model, source: "ark", seed };

}
export async function comfyGenerateScene(options: {
  prompt: string;
  refImageUrl?: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string; source: string }> {
  const size = parseSize(options.size || "1024x1024");
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const sceneNeg = options.negativePrompt ||
    "blurry, low quality, distorted, deformed, ugly, watermark, text errors, bad typography";

  // Try Z-Image Turbo locally first
  try {
    const workflow = buildZTWorkflow(options.prompt, sceneNeg, size.width, size.height, seed);
    const { filename, durationMs } = await submitAndWait(workflow);
    const imageUrl = await readImageAsBase64(filename);
    return { imageUrl, durationMs, model: "z_image_turbo_nvfp4", source: "local" };
  } catch (ztErr) {
    // 部署红线（Chris 2026-08-03）：生图必须本地完成，禁止回退到付费 ARK。
    const arkDisabled = (process.env.COMFYUI_DISABLE_ARK_FALLBACK || "").trim() === "1";
    // 工单 030：日志文案修正——禁用回退时不再误导为“falling back to ARK”。
    console.warn(`[comfyui] Z-Image Turbo failed, ${arkDisabled ? "ARK fallback disabled, rethrowing" : "falling back to ARK"}:`, (ztErr as Error).message.slice(0, 100));
    if (arkDisabled) throw ztErr;
  }

  // Fallback to ARK cloud
  const arkResult = await arkGenerate(options.prompt, sceneNeg, size.width, size.height);
  return { imageUrl: arkResult.imageUrl, durationMs: 0, model: arkResult.model, source: "ark" };

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

