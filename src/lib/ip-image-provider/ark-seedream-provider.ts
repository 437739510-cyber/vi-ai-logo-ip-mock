/**
 * IP Image Provider Layer — Ark Seedream Provider
 *
 * VolcEngine Ark Seedream image generation via REST API.
 *
 * Models & Free Quota Strategy (消耗免费额度优先):
 *   Logo(文生图): 3.0(200张) → 4.5(200张) → 5.0Lite(50张) → 4.0(191张)
 *   场景图(图生图): 4.5(200张) → 5.0Lite(50张) → 4.0(191张)
 *
 * API: https://ark.cn-beijing.volces.com/api/v3/images/generations
 */

import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";

// ========== Constants ==========

const ARK_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const TIMEOUT_MS = 120_000;

const MODEL_V3 = "doubao-seedream-3-0-t2i-250415";
const MODEL_V45 = "doubao-seedream-4-5-251128";
const MODEL_V5LITE = "doubao-seedream-5-0-260128";
const MODEL_V4 = "doubao-seedream-4-0-250828";

// 文生图fallback链: 3.0(200张免费) → 4.5(200张) → 5.0Lite(50张) → 4.0(191张)
const TXT2IMG_MODELS = [MODEL_V3, MODEL_V45, MODEL_V5LITE, MODEL_V4];

// 图生图fallback链: 4.5(200张) → 5.0Lite(50张) → 4.0(191张)  (3.0不支持图生图)
const IMG2IMG_MODELS = [MODEL_V45, MODEL_V5LITE, MODEL_V4];

// ========== Error Types ==========

export class ArkSeedreamError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ArkSeedreamError";
  }
}

// ========== Provider ==========

export class ArkSeedreamProvider implements ImageProvider {
  name = "ark-seedream";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ARK_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    if (!this.apiKey) {
      throw new ArkSeedreamError("ARK_API_KEY not configured", "NO_API_KEY", 401, false);
    }

    const isImageToImage = !!params.seedAssetId && params.seedAssetId.startsWith("http");
    const models = isImageToImage ? IMG2IMG_MODELS : TXT2IMG_MODELS;

    // 按fallback链依次尝试
    for (const model of models) {
      try {
        const payload = this.buildPayload(model, params, isImageToImage);
        const cost = estimateArkCost(model, 1);
        const startTime = Date.now();

        const response = await this.postWithRetry(payload);
        const data = await response.json();

        if (data.error) {
          console.warn(`[ArkSeedream] ${model} error: ${data.error.code} - ${data.error.message}`);
          // 如果是额度/模型问题,尝试下一个模型
          if (this.isQuotaOrModelError(data.error)) continue;
          // 其他错误直接抛
          throw new ArkSeedreamError(
            data.error.message || "Unknown Ark API error",
            data.error.code || "ARK_ERROR",
            response.status,
            response.status === 429 || response.status >= 500
          );
        }

        const imageUrl = data?.data?.[0]?.url || "";
        if (!imageUrl) {
          throw new ArkSeedreamError("No image URL in response", "NO_IMAGE", 200, true);
        }

        return {
          imageUrl,
          actualCost: cost,
          durationMs: Date.now() - startTime,
          assetId: `ark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          providerName: "ark-seedream",
          qualityScore: undefined,
          providerMeta: {
            model,
            mode: isImageToImage ? "img2img" : "txt2img",
            imageCount: data.data?.length || 1,
          },
        };
      } catch (error) {
        if (error instanceof ArkSeedreamError) throw error;
        console.warn(`[ArkSeedream] ${model} threw: ${(error as Error).message}`);
        // 网络等错误,尝试下一个模型
        continue;
      }
    }

    throw new ArkSeedreamError("All models in fallback chain failed", "ALL_MODELS_FAILED", 0, true);
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    return this.generateImage({
      ...params,
      step: { ...params.step, stepId: params.step.stepId + "-variant" },
    });
  }

  private buildPayload(model: string, params: GenerateImageParams, isImageToImage: boolean): object {
    const sizeStr = this.mapSize(params.output.width, params.output.height);
    const payload: any = {
      model,
      prompt: params.prompt,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: sizeStr,
      watermark: false,
    };
    if (params.negativePrompt) payload.negative_prompt = params.negativePrompt;
    if (isImageToImage) payload.image = [params.seedAssetId];
    return payload;
  }

  private mapSize(w: number, h: number): string {
    if (w <= 800 && h > 1000) return "720x1280";
    if (w === h && w <= 1024) return "1024x1024";
    if (w >= 2048 || h >= 2048) return "2K";
    return "1024x1024";
  }

  private isQuotaOrModelError(error: { code?: string; message?: string }): boolean {
    const code = (error.code || "").toLowerCase();
    const msg = (error.message || "").toLowerCase();
    return (
      code.includes("modelnotopen") ||
      code.includes("quota") ||
      code.includes("limit") ||
      code.includes("insufficient") ||
      code.includes("balance") ||
      msg.includes("model not open") ||
      msg.includes("quota") ||
      msg.includes("insufficient") ||
      msg.includes("balance")
    );
  }

  private async postWithRetry(payload: object, maxRetries = 2): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(ARK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (response.ok) return response;

        // 429或5xx, 重试
        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxRetries) {
            await this.sleep(Math.min(1000 * Math.pow(2, attempt), 15_000));
            continue;
          }
        }
        // 其他错误直接返回,让调用方解析
        return response;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          throw new ArkSeedreamError("Request timed out", "TIMEOUT", 0, true);
        }
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.sleep(Math.min(1000 * Math.pow(2, attempt), 15_000));
        }
      }
    }

    throw new ArkSeedreamError(
      `Request failed after ${maxRetries} retries: ${lastError?.message}`,
      "MAX_RETRIES_EXCEEDED", 0, false
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ========== Standalone API Functions (for route.ts direct usage) ==========

/**
 * 文生图 — Logo生成, 按fallback链消耗免费额度
 */
export async function arkGenerateLogo(options: {
  prompt: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string }> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("ARK_API_KEY not configured");

  for (const model of TXT2IMG_MODELS) {
    try {
      const result = await arkRawCall({
        model,
        prompt: options.prompt,
        negativePrompt: options.negativePrompt,
        size: options.size || "1024x1024",
      });
      console.log(`[ArkSeedream] Logo generated with ${model}`);
      return { ...result, model };
    } catch (err: any) {
      console.warn(`[ArkSeedream] ${model} logo failed: ${err.message}`);
      // 继续尝试下一个模型
    }
  }

  throw new Error("All Ark models failed for logo generation");
}

/**
 * 图生图 — 场景图生成, 按fallback链消耗免费额度
 */
export async function arkGenerateScene(options: {
  prompt: string;
  refImageUrl: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number; model: string }> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("ARK_API_KEY not configured");

  for (const model of IMG2IMG_MODELS) {
    try {
      const payload: any = {
        model,
        prompt: options.prompt,
        image: [options.refImageUrl],
        sequential_image_generation: "disabled",
        response_format: "url",
        size: options.size || "720x1280",
        watermark: false,
      };
      if (options.negativePrompt) payload.negative_prompt = options.negativePrompt;

      const startTime = Date.now();
      const resp = await fetch(ARK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const durationMs = Date.now() - startTime;

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`[ArkSeedream] ${model} scene error ${resp.status}: ${errText.slice(0, 200)}`);
        continue; // 尝试下一个模型
      }

      const data = await resp.json();
      if (data.error) {
        console.warn(`[ArkSeedream] ${model} scene API error: ${data.error.message}`);
        continue;
      }

      const imageUrl = data?.data?.[0]?.url;
      if (!imageUrl) {
        console.warn(`[ArkSeedream] ${model} scene: no image URL`);
        continue;
      }

      console.log(`[ArkSeedream] Scene generated with ${model}`);
      return { imageUrl, durationMs, model };
    } catch (err: any) {
      console.warn(`[ArkSeedream] ${model} scene threw: ${err.message}`);
    }
  }

  throw new Error("All Ark models failed for scene generation");
}

/** 底层文生图API调用 */
async function arkRawCall(options: {
  model: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;
}): Promise<{ imageUrl: string; durationMs: number }> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("ARK_API_KEY not configured");

  const payload: any = {
    model: options.model,
    prompt: options.prompt,
    sequential_image_generation: "disabled",
    response_format: "url",
    size: options.size || "1024x1024",
    watermark: false,
  };
  if (options.negativePrompt) payload.negative_prompt = options.negativePrompt;

  const startTime = Date.now();
  const resp = await fetch(ARK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const durationMs = Date.now() - startTime;

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Ark API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(`Ark API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL in Ark response");

  return { imageUrl, durationMs };
}

// ========== Cost Estimation ==========

export function estimateArkCost(model: string, count: number): number {
  return getArkUnitCost(model) * count;
}

export function getArkUnitCost(model: string): number {
  switch (model) {
    case MODEL_V3: return 0.259;
    case MODEL_V45: return 0.25;
    case MODEL_V5LITE: return 0.22;
    case MODEL_V4: return 0.20;
    default: return 0.20;
  }
}
