/**
 * IP Sandbox V1 — Image Generator (Placeholder)
 *
 * Placeholder implementation — no real image generation.
 * Future: replace with Tongyi Wanxiang API call.
 *
 * Current phase: returns placeholder URL + simulated cost.
 */

import type { IPSandboxStep } from "./types";
import type { BrandProfile } from "@/lib/brand-analyzer";
import type { MascotProfile } from "@/agents/mascot-designer";
import type { MascotPromptSet } from "@/lib/mascot-prompt-strategy";

// ========== Placeholder Cost Constants ==========

const PLACEHOLDER_COST_PER_IMAGE = 10; // simulated cost in credits
const PLACEHOLDER_DELAY_MS = 1500; // simulated generation time

// ========== Input Types ==========

export interface GenerateStepImageParams {
  step: IPSandboxStep;
  brandProfile: BrandProfile;
  mascotProfile: MascotProfile;
  promptSet: MascotPromptSet;
}

export interface GenerateStepImageResult {
  imageUrl: string;
  actualCost: number;
  durationMs: number;
}

// ========== Placeholder Generator ==========

/**
 * Generate a single IP asset image.
 *
 * CURRENT: Placeholder — simulates generation delay and returns empty URL.
 * FUTURE: Will call Tongyi Wanxiang or other image API.
 */
export async function generateStepImage(
  _params: GenerateStepImageParams
): Promise<GenerateStepImageResult> {
  // Simulate generation delay
  await new Promise((resolve) =>
    setTimeout(resolve, PLACEHOLDER_DELAY_MS + Math.random() * 1000)
  );

  return {
    imageUrl: "", // Future: actual image URL from Tongyi Wanxiang
    actualCost: PLACEHOLDER_COST_PER_IMAGE,
    durationMs: PLACEHOLDER_DELAY_MS,
  };
}

/**
 * Regenerate a step with a different variation.
 *
 * CURRENT: Same as generateStepImage.
 * FUTURE: Will pass a different seed/variation to the image API.
 */
export async function regenerateStepImage(
  params: GenerateStepImageParams
): Promise<GenerateStepImageResult> {
  return generateStepImage(params);
}
