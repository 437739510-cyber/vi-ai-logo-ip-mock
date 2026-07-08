/**
 * IP Image Provider Layer 闂?ComfyUI Provider (闂佸搫鐗滈崜娆忥耿?
 *
 * Local image generation via ComfyUI REST API (http://127.0.0.1:8188).
 * Uses Z-Image Turbo model with UNETLoader + DualCLIPLoader workflow.
 *
 * Cloud APIs are all dead (ARK, DashScope, 闂備緡鍋呴惌顔剧不?, so this is the only
 * working option for image generation.
 */

import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";
import * as fs from "fs";
import * as path from "path";
import imageGenConfig from "../../../config/image-gen-config.json";

// ========== Constants ==========

const COMFYUI_BASE = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const PROMPT_URL = `${COMFYUI_BASE}/api/prompt`;
const HISTORY_URL = `${COMFYUI_BASE}/api/history`;
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;
// ========== Config Loader ==========

type ImageGenConfig = typeof imageGenConfig;

function getImageGenConfig(): ImageGenConfig {
  try {
    return imageGenConfig;
  } catch {
    // Fallback defaults if config file is missing/corrupted
    return {
      version: 1,
      models: { dreamshaperXL: "dreamshaperXL_alpha2Xl10.safetensors", juggernautXL: "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors" },
      logo: { model: "dreamshaperXL", width: 1024, height: 1024, steps: 28, cfg: 5.5, sampler: "dpmpp_2m", scheduler: "karras", negative_prompt: "deformed, blurry, low quality, distorted, 3d render, shadow, gradient, complex background, watermark, text, extra limbs, bad anatomy" },
      scene: { model: "dreamshaperXL", width: 1024, height: 1024, steps: 25, cfg: 6.0, sampler: "dpmpp_2m_sde", scheduler: "karras", scene_negative_fallback: "blurry, low quality, distorted logo, garbled text, 3d render, cartoon, watermark" },
      scene_workflows: {},
    } as unknown as ImageGenConfig;
  }
}


// DreamShaperXL (SDXL) workflow - primary option
function buildSDXLWorkflow(
  prompt: string, negativePrompt: string, width: number, height: number, seed: number,
  genParams?: { steps?: number; cfg?: number; sampler_name?: string; scheduler?: string }
) {
  const p = genParams || {};
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: p.steps ?? getImageGenConfig().logo.steps,
        cfg: p.cfg ?? getImageGenConfig().logo.cfg,
        sampler_name: p.sampler_name ?? getImageGenConfig().logo.sampler,
        scheduler: p.scheduler ?? getImageGenConfig().logo.scheduler,
        denoise: 1,
        model: ["4", 0], positive: ["6", 0],
        negative: ["7", 0], latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: (() => { try { const cfg = getImageGenConfig(); return (cfg.models as any)[cfg.logo.model] || "dreamshaperXL_alpha2Xl10.safetensors"; } catch { return "dreamshaperXL_alpha2Xl10.safetensors"; } })() },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: roundTo8(width), height: roundTo8(height), batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, distorted", clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui_sdxl", images: ["8", 0] },
    },
  };
}

// ========== Base Workflow Template (Z-Image Turbo) ==========

function buildWorkflow(
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number,
  seed: number
): object {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed, steps: 25, cfg: 3.5,
        sampler_name: "euler", scheduler: "normal", denoise: 1,
        model: ["4", 0], positive: ["6", 0],
        negative: ["7", 0], latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "UNETLoader",
      inputs: { unet_name: "z_image_turbo_bf16.safetensors", weight_dtype: "default" },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: roundTo8(width), height: roundTo8(height), batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["8", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, distorted", clip: ["8", 0] },
    },
    "8": {
      class_type: "DualCLIPLoader",
      inputs: { clip_name1: "qwen_3_4b.safetensors", clip_name2: "qwen_3_4b.safetensors", type: "flux" },
    },
    "9": {
      class_type: "VAELoader",
      inputs: { vae_name: "ae.safetensors" },
    },
    "10": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["9", 0] },
    },
    "11": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui_gen", images: ["10", 0] },
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

// ========== Helper Functions ==========

function roundTo8(n: number): number {
  return Math.max(64, Math.round(n / 8) * 8);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function comfyGenerateSync(
  workflow: object,
  timeoutMs: number = TIMEOUT_MS
): Promise<{ filename: string; durationMs: number }> {
  const startTime = Date.now();

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
      "QUEUE_ERROR", true
    );
  }

  const promptData = await promptResponse.json();
  const promptId = promptData.prompt_id;
  if (!promptId) {
    throw new ComfyUIError("No prompt_id in ComfyUI response", "NO_PROMPT_ID", true);
  }

  let filename = null;
  let error = null;

  while (Date.now() - startTime < timeoutMs) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const histResponse = await fetch(`${HISTORY_URL}/${promptId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (histResponse.status === 404) continue;
      if (!histResponse.ok) continue;

      const histData = await histResponse.json();
      const promptResult = histData[promptId];
      if (!promptResult) continue;

      if (promptResult.status?.status_str === "error") {
        error = promptResult.status?.reason || "Unknown ComfyUI error";
        break;
      }

      const outputs = promptResult.outputs;
      if (outputs) {
        const nodeOutput = outputs["11"];
        if (nodeOutput?.images?.[0]?.filename) {
          filename = nodeOutput.images[0].filename;
          break;
        }
        for (const nodeId of Object.keys(outputs)) {
          const images = outputs[nodeId]?.images;
          if (images?.[0]?.filename) {
            filename = images[0].filename;
            break;
          }
        }
        if (filename) break;
      }
      if (promptResult.status?.completed === true && !filename) {
        error = "Generation completed but no image found in output";
        break;
      }
    } catch { }
  }

  if (error) throw new ComfyUIError(`ComfyUI generation error: ${error}`, "GENERATION_ERROR", true);
  if (!filename) throw new ComfyUIError(`ComfyUI timed out after ${timeoutMs}ms`, "TIMEOUT", true);

  return { filename, durationMs: Date.now() - startTime };
}

async function readImageAsBase64(filename: string): Promise<string> {
  const viewUrl = COMFYUI_BASE + "/view?filename=" + encodeURIComponent(filename) + "&type=output";
  const resp = await fetch(viewUrl, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) {
    throw new ComfyUIError("Generated image not found via HTTP: " + filename + " (" + resp.status + ")", "FILE_NOT_FOUND", false);
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  const base64 = buffer.toString("base64");
  return "data:image/png;base64," + base64;
}

// ========== Provider Implementation ==========

export class ComfyUIProvider implements ImageProvider {
  name = "comfyui";

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(COMFYUI_BASE, { signal: AbortSignal.timeout(3_000) });
      return response.ok;
    } catch { return false; }
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    if (!(await this.isAvailable())) {
      throw new ComfyUIError("ComfyUI not running", "NOT_AVAILABLE", false);
    }
    const startTime = Date.now();
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const width = params.output.width || 1024;
    const height = params.output.height || 1024;

    // Try DreamShaperXL (SDXL) first, fall back to Z-Image Turbo
    try {
      const sdxlWorkflow = buildSDXLWorkflow(params.prompt, params.negativePrompt, width, height, seed);
      const sdxlStart = Date.now();
      const sdxlResult = await comfyGenerateSync(sdxlWorkflow);
      const sdxlImage = await readImageAsBase64(sdxlResult.filename);
      return {
        imageUrl: sdxlImage, actualCost: 0, durationMs: sdxlResult.durationMs,
        assetId: `comfyui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        providerName: "comfyui",
        providerMeta: { model: getImageGenConfig().logo.model, width, height, seed, steps: 20 },
      };
    } catch (sdxlErr) {
      console.warn("[comfyui-provider] SDXL failed, trying Z-Image Turbo:", (sdxlErr as Error).message);
    }
    const workflow = buildSDXLWorkflow(params.prompt, params.negativePrompt, width, height, seed);
    const { filename, durationMs } = await comfyGenerateSync(workflow);
    const imageUrl = await readImageAsBase64(filename);
    return {
      imageUrl, actualCost: 0, durationMs,
      assetId: `comfyui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerName: "comfyui",
      providerMeta: { model: "z_image_turbo_bf16", width, height, seed, steps: 25 },
    };
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    return this.generateImage({
      ...params,
      step: { ...params.step, stepId: params.step.stepId + "-variant" },
    });
  }
}

// ========== Standalone API Functions ==========

export async function comfyGenerateImage(options: {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  genParams?: { steps?: number; cfg?: number; sampler_name?: string; scheduler?: string }
}): Promise<{ imageUrl: string; durationMs: number }> {
  const seed = options.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const workflow = buildSDXLWorkflow(
    options.prompt, options.negativePrompt || "",
    options.width || 1024, options.height || 1024, seed,
    options.genParams
  );
  const { filename, durationMs } = await comfyGenerateSync(workflow);
  const imageUrl = await readImageAsBase64(filename);
  return { imageUrl, durationMs };
}

export async function comfyGenerateLogo(options: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string }> {
  const size = parseSize(options.size || "1024x1024");
  const cfg = getImageGenConfig();
  const { imageUrl, durationMs } = await comfyGenerateImage({
    prompt: options.prompt, negativePrompt: options.negativePrompt,
    width: size.width, height: size.height,
    genParams: { steps: cfg.logo.steps, cfg: cfg.logo.cfg, sampler_name: cfg.logo.sampler, scheduler: cfg.logo.scheduler },
  });
  return { imageUrl, durationMs, model: cfg.logo.model };
}

export async function comfyGenerateScene(options: {
  prompt: string;
  refImageUrl?: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string }> {
  const size = parseSize(options.size || "1024x1024");
  const cfg2 = getImageGenConfig();
  const { imageUrl, durationMs } = await comfyGenerateImage({
    prompt: options.prompt, negativePrompt: options.negativePrompt,
    width: size.width, height: size.height,
    genParams: { steps: cfg2.scene.steps, cfg: cfg2.scene.cfg, sampler_name: cfg2.scene.sampler, scheduler: cfg2.scene.scheduler },
  });
  return { imageUrl, durationMs, model: cfg2.scene.model };
}


// ========== Generic Workflow Runner ==========

/**
 * Submit an arbitrary ComfyUI workflow JSON and get the generated image.
 * Unlike comfyGenerateImage which builds a workflow from prompts, this
 * accepts a pre-built workflow (e.g. from comfyui-workflows/*.json).
 */
export async function comfyGenerateFromWorkflow(
  workflow: Record<string, any>,
  options?: { timeoutMs?: number }
): Promise<{ imageUrl: string; durationMs: number }> {
  const { filename, durationMs } = await comfyGenerateSync(workflow, options?.timeoutMs);
  const imageUrl = await readImageAsBase64(filename);
  return { imageUrl, durationMs };
}

// ========== Aliases for Route Compatibility ==========

/** Alias: used by generate-logo/route.ts */
export const comfyuiGenerateLogo = comfyGenerateLogo;
/** Alias: used by generate-manual-pptx/route.ts */
export const comfyuiGenerateScene = comfyGenerateScene;
/** Alias: check if ComfyUI is running */
export async function isComfyUIAvailable(): Promise<boolean> {
  try {
    const response = await fetch(COMFYUI_BASE, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch { return false; }
}

// ========== Utility ==========

function parseSize(sizeStr: string): { width: number; height: number } {
  const parts = sizeStr.toLowerCase().split("x");
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && !isNaN(h)) return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}
