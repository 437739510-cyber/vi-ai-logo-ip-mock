/**
 * IP Image Provider Layer — Mock Provider
 *
 * Placeholder implementation — no real image generation.
 * Always available. Returns fixed cost and empty URL.
 *
 * Future: Real providers (Wanxiang, Flux, Midjourney) replace this.
 */

import type { ImageProvider, GenerateImageParams, GenerateImageResult } from "./types";

const PLACEHOLDER_COST = 10; // simulated cost in credits
const PLACEHOLDER_DELAY_MS = 1500; // simulated delay

export class MockProvider implements ImageProvider {
  name = "mock";

  private counter = 0;

  async isAvailable(): Promise<boolean> {
    return true; // always available
  }

  async generateImage(_params: GenerateImageParams): Promise<GenerateImageResult> {
    this.counter++;

    // Simulate generation delay
    await new Promise((resolve) =>
      setTimeout(resolve, PLACEHOLDER_DELAY_MS + Math.random() * 1000)
    );

    return {
      imageUrl: "", // Future: actual image URL
      actualCost: PLACEHOLDER_COST,
      durationMs: PLACEHOLDER_DELAY_MS,
      assetId: `mock-asset-${this.counter}-${Date.now()}`,
      providerName: "mock",
      qualityScore: 75, // simulated default score
    };
  }

  async generateVariant(params: GenerateImageParams): Promise<GenerateImageResult> {
    return this.generateImage(params);
  }
}
