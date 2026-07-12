/**
 * IP Image Provider Layer — LiblibAI Provider
 *
 * Cloud image generation via LiblibAI OpenAPI (https://openapi.liblibai.cloud).
 * Uses Star-3 Alpha model with HMAC-SHA1 signing.
 *
 * Trial plan: concurrency=1, must be serial.
 * API: POST /api/generate/webui/text2img/ultra (submit)
 *      POST /api/generate/webui/status (poll, note: POST not GET)
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/core/supabase";
import type {
  ImageProvider,
  GenerateImageParams,
  GenerateImageResult,
} from "./types";

// ========== Constants ==========

const BASE_URL = "https://openapi.liblibai.cloud";
const SUBMIT_PATH = "/api/generate/webui/text2img/ultra";
const STATUS_PATH = "/api/generate/webui/status";
const TEMPLATE_UUID = "5d7e67009b344550bc1aa6ccbfa1d7f4"; // Star-3 Alpha
const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_MS = 180_000;

// ========== Error Types ==========

export class LiblibAIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "LiblibAIError";
  }
}

// ========== Signing ==========

function signRequest(
  urlPath: string,
  accessKey: string,
  secretKey: string
): string {
  const ts = Date.now().toString();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 16; i++) {
    nonce += chars[Math.floor(Math.random() * chars.length)];
  }
  const raw = urlPath + "&" + ts + "&" + nonce;
  const sig = crypto
    .createHmac("sha1", secretKey)
    .update(raw)
    .digest();
  const sigBase64 = sig
    .toString("base64url")
    .replace(/=+$/, "");
  return (
    BASE_URL +
    urlPath +
    "?AccessKey=" +
    accessKey +
    "&Signature=" +
    sigBase64 +
    "&Timestamp=" +
    ts +
    "&SignatureNonce=" +
    nonce
  );
}

// ========== Provider ==========

export class LiblibAIProvider implements ImageProvider {
  name = "liblibai";
  private accessKey: string;
  private secretKey: string;
  private inFlight = false; // Trial plan concurrency=1

  constructor() {
    this.accessKey = process.env.LIBLIBAI_ACCESS_KEY || "";
    this.secretKey = process.env.LIBLIBAI_SECRET_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.accessKey && !!this.secretKey;
  }

  async generateImage(
    params: GenerateImageParams
  ): Promise<GenerateImageResult> {
    if (!this.accessKey || !this.secretKey) {
      throw new LiblibAIError(
        "LIBLIBAI_ACCESS_KEY or LIBLIBAI_SECRET_KEY not configured",
        "NO_API_KEY",
        false
      );
    }

    // Serialize: wait for any in-flight request to complete
    while (this.inFlight) {
      await this.sleep(500);
    }
    this.inFlight = true;

    try {
      const startTime = Date.now();
      const w = params.output?.width || 512;
      const h = params.output?.height || 512;

      // Step 1: Submit generation task
      const generateUuid = await this.submit(params.prompt, w, h);

      // Step 2: Poll until complete
      const data = await this.poll(generateUuid);

      // Step 3: Download image
      const imageUrl =
        data?.images?.[0]?.imageUrl || "";
      if (!imageUrl) {
        throw new LiblibAIError(
          "No image URL in response",
          "NO_IMAGE",
          true
        );
      }

      const imageDataUrl = await this.downloadAsDataUrl(imageUrl);
      const durationMs = Date.now() - startTime;

      // fire-and-forget: log usage to api_usage_log
      this.logUsage(generateUuid, durationMs).catch(() => {});

      return {
        imageUrl: imageDataUrl,
        actualCost: 0,
        durationMs,
        assetId: `liblibai-${generateUuid}`,
        providerName: "liblibai",
        qualityScore: undefined,
        providerMeta: {
          generateUuid,
          templateUuid: TEMPLATE_UUID,
          model: "Star-3 Alpha",
        },
      };
    } finally {
      this.inFlight = false;
    }
  }

  async generateVariant(
    params: GenerateImageParams
  ): Promise<GenerateImageResult> {
    return this.generateImage(params);
  }

  // ========== Private Methods ==========

  private async submit(
    prompt: string,
    width: number,
    height: number
  ): Promise<string> {
    const url = signRequest(
      SUBMIT_PATH,
      this.accessKey,
      this.secretKey
    );
    const body = JSON.stringify({
      templateUuid: TEMPLATE_UUID,
      generateParams: {
        prompt,
        imageSize: { width, height },
        imgCount: 1,
        steps: 28,
      },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      const data = await resp.json();
      if (data.code === 0 && data.data?.generateUuid) {
        return data.data.generateUuid;
      }

      throw new LiblibAIError(
        `Submit failed: ${JSON.stringify(data)}`,
        data.code?.toString() || "SUBMIT_FAILED",
        false
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new LiblibAIError("Submit timed out", "TIMEOUT", true);
      }
      if (error instanceof LiblibAIError) throw error;
      throw new LiblibAIError(
        `Submit error: ${(error as Error).message}`,
        "SUBMIT_ERROR",
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async poll(generateUuid: string): Promise<any> {
    const deadline = Date.now() + MAX_POLL_MS;

    while (Date.now() < deadline) {
      const url = signRequest(
        STATUS_PATH,
        this.accessKey,
        this.secretKey
      );
      const body = JSON.stringify({ generateUuid });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });

        const data = await resp.json();

        if (data.code !== 0) {
          console.warn(
            `[LiblibAI] Poll code=${data.code}, retrying...`
          );
          await this.sleep(POLL_INTERVAL_MS);
          continue;
        }

        const genData = data.data;
        const status = genData.generateStatus;

        if (status === 5) {
          return genData; // Done
        }
        if (status === -1) {
          throw new LiblibAIError(
            `Generation failed: ${JSON.stringify(genData)}`,
            "GEN_FAILED",
            false
          );
        }

        console.log(
          `[LiblibAI] Poll: status=${status} pct=${genData.percentCompleted || 0}`
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Poll timeout, retry
        } else if (error instanceof LiblibAIError) {
          throw error;
        } else {
          console.warn(
            `[LiblibAI] Poll error: ${(error as Error).message}`
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new LiblibAIError(
      `Poll timeout after ${MAX_POLL_MS}ms`,
      "POLL_TIMEOUT",
      true
    );
  }

  private async downloadAsDataUrl(
    imageUrl: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(imageUrl, {
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new LiblibAIError(
          `Download failed: HTTP ${resp.status}`,
          "DOWNLOAD_FAILED",
          true
        );
      }

      const contentType =
        resp.headers.get("content-type") || "image/png";
      const arrayBuffer = await resp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new LiblibAIError(
          "Download timed out",
          "DOWNLOAD_TIMEOUT",
          true
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async logUsage(generateUuid: string, durationMs: number): Promise<void> {
    try {
      await supabaseAdmin.from("api_usage_log").insert({
        route: "liblibai-generate",
        method: "POST",
        model: "liblibai-star3-alpha",
        cost_cny: 0,
        request_summary: "image",
        response_status: 200,
      });
    } catch {
      // fire-and-forget, never throw
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}