/**
 * IP Image Provider Layer — Wanxiang Provider
 *
 * Tongyi Wanxiang image generation via Alibaba Cloud DashScope API.
 *
 * Models:
 *   - wanx2.1-t2i-turbo: Fast (~5s), lower cost (~80 credits)
 *   - wanx2.1-t2i-plus:  Higher quality (~15s), higher cost (~200 credits)
 *
 * API: https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis
 * Docs: https://help.aliyun.com/zh/dashscope/
 */

import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";
import { estimateWanxiangCost } from "@/lib/wanxiang-cost";

// ========== Constants ==========

const DASHSCOPE_BASE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

const TASK_POLL_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";

const TIMEOUT_MS = 120_000; // 2 minutes total (including async polling)

const POLL_INTERVALS = [2000, 4000, 8000, 15000, 30000]; // exponential backoff

// ========== Error Types ==========

export class WanxiangError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "WanxiangError";
  }
}

// ========== Provider ==========

export class WanxiangProvider implements ImageProvider {
  name = "wanxiang";

  private apiKey: string;

  constructor() {
    this.apiKey =
      process.env.WANXIANG_API_KEY || process.env.ALIYUN_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateImage(
    params: GenerateImageParams
  ): Promise<GenerateImageResult> {
    if (!this.apiKey) {
      throw new WanxiangError(
        "WANXIANG_API_KEY not configured",
        "NO_API_KEY",
        401,
        false
      );
    }

    const model = this.selectModel(params.step.stepId);
    const payload = this.buildPayload(model, params);
    const cost = estimateWanxiangCost(model, 1);

    const response = await this.postWithRetry(payload);

    // Parse response
    const data = await response.json();

    // Handle sync response (turbo)
    if (data.output?.task_status === "SUCCEEDED") {
      return this.buildResult(data, model, cost, params);
    }

    // Handle async response (plus) — poll until complete
    if (data.output?.task_id) {
      return this.pollTask(data.output.task_id, model, cost, params);
    }

    // Handle error response
    if (data.code) {
      throw this.mapError(data.code, data.message || "Unknown error");
    }

    throw new WanxiangError(
      "Unexpected API response format",
      "UNEXPECTED_RESPONSE",
      200,
      false
    );
  }

  async generateVariant(
    params: GenerateImageParams
  ): Promise<GenerateImageResult> {
    // Generate variant with a random seed for variation
    const variantParams: GenerateImageParams = {
      ...params,
      step: {
        ...params.step,
        stepId: params.step.stepId + "-variant",
      },
    };
    return this.generateImage(variantParams);
  }

  // ========== Model Selection ==========

  private selectModel(stepId: string): string {
    // Turbo steps: fast iteration items
    const turboSteps = [
      "mascot-main",
      "mascot-three-view",
      "mascot-expression",
      "mascot-action",
      "mascot-colors",
    ];

    if (turboSteps.includes(stepId) || stepId.includes("social")) {
      return "wanx2.1-t2i-turbo";
    }

    // Plus for high-quality deliverables
    if (
      stepId.includes("packaging") ||
      stepId.includes("scene") ||
      stepId.includes("store")
    ) {
      return "wanx2.1-t2i-plus";
    }

    // Default: turbo (faster, cheaper)
    return "wanx2.1-t2i-turbo";
  }

  // ========== Payload Builder ==========

  private buildPayload(
    model: string,
    params: GenerateImageParams
  ): object {
    return {
      model,
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || undefined,
      },
      parameters: {
        size: `${params.output.width}*${params.output.height}`,
        n: 1,
        seed: params.seedAssetId
          ? this.hashSeed(params.seedAssetId)
          : undefined,
      },
    };
  }

  /** Derive a numeric seed from a string asset ID for consistency */
  private hashSeed(assetId: string): number {
    let hash = 0;
    for (let i = 0; i < assetId.length; i++) {
      const char = assetId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // ========== HTTP Call with Retry ==========

  private async postWithRetry(
    payload: object,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(DASHSCOPE_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success
        if (response.ok) {
          return response;
        }

        // Rate limited or server error — retry
        if (
          response.status === 429 ||
          response.status === 500 ||
          response.status === 503
        ) {
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
            await this.sleep(delay);
            continue;
          }
          const body = await response.text();
          throw new WanxiangError(
            `Service temporarily unavailable after ${maxRetries} retries: ${body.slice(0, 200)}`,
            `HTTP_${response.status}`,
            response.status,
            true
          );
        }

        // Non-retryable errors
        const body = await response.text();
        throw this.mapHttpError(response.status, body);
      } catch (error) {
        if (error instanceof WanxiangError) throw error;
        if ((error as Error).name === "AbortError") {
          throw new WanxiangError(
            "Request timed out after 120s",
            "TIMEOUT",
            0,
            true
          );
        }
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
          await this.sleep(delay);
        }
      }
    }

    throw new WanxiangError(
      `Request failed after ${maxRetries} retries: ${lastError?.message}`,
      "MAX_RETRIES_EXCEEDED",
      0,
      false
    );
  }

  // ========== Async Task Polling ==========

  private async pollTask(
    taskId: string,
    model: string,
    cost: number,
    params: GenerateImageParams
  ): Promise<GenerateImageResult> {
    for (const interval of POLL_INTERVALS) {
      await this.sleep(interval);

      const response = await fetch(`${TASK_POLL_URL}/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new WanxiangError(
          `Task polling failed: HTTP ${response.status}`,
          "POLL_FAILED",
          response.status,
          true
        );
      }

      const data = await response.json();

      if (data.output?.task_status === "SUCCEEDED") {
        return this.buildResult(data, model, cost, params);
      }

      if (
        data.output?.task_status === "FAILED" ||
        data.output?.task_status === "CANCELED"
      ) {
        throw new WanxiangError(
          `Task ${data.output.task_status}: ${data.output.message || "Unknown"}`,
          `TASK_${data.output.task_status}`,
          200,
          false
        );
      }

      // Still PENDING or RUNNING — continue polling
    }

    // Exhausted poll intervals
    throw new WanxiangError(
      "Task did not complete within polling budget",
      "POLL_TIMEOUT",
      0,
      true
    );
  }

  // ========== Response Builder ==========

  private buildResult(
    data: any,
    model: string,
    cost: number,
    params: GenerateImageParams
  ): GenerateImageResult {
    const results = data.output?.results || [];
    const imageUrl = results[0]?.url || "";

    return {
      imageUrl,
      actualCost: cost,
      durationMs: 0, // Set by caller or MetricsProvider
      assetId: `wanxiang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerName: "wanxiang",
      qualityScore: undefined,
      providerMeta: {
        model,
        taskId: data.output?.task_id,
        imageCount: results.length,
      },
    };
  }

  // ========== Error Mapping ==========

  private mapHttpError(status: number, body: string): WanxiangError {
    let message = `HTTP ${status}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.message) message = parsed.message;
      if (parsed.code) message = `[${parsed.code}] ${parsed.message || ""}`;
    } catch {
      message = body.slice(0, 200);
    }

    switch (status) {
      case 400:
        return new WanxiangError(message, "INVALID_PROMPT", 400, false);
      case 401:
        return new WanxiangError(
          "Invalid API key. Check WANXIANG_API_KEY in .env.local",
          "INVALID_API_KEY",
          401,
          false
        );
      case 403:
        return new WanxiangError(
          "Insufficient balance or access denied",
          "INSUFFICIENT_BALANCE",
          403,
          false
        );
      case 413:
        return new WanxiangError(
          "Content filtered by safety system. Try modifying the prompt.",
          "CONTENT_FILTERED",
          413,
          false
        );
      default:
        return new WanxiangError(message, `HTTP_${status}`, status, false);
    }
  }

  private mapError(code: string, message: string): WanxiangError {
    return new WanxiangError(
      `[${code}] ${message}`,
      code,
      200,
      code === "Throttling" || code === "ServiceUnavailable"
    );
  }

  // ========== Utility ==========

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
