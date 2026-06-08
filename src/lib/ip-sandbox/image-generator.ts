/**
 * IP Sandbox V1 — Image Generator
 *
 * Calls the IP Image Provider Layer to generate step images.
 * Sandbox doesn't know whether MockProvider or Wanxiang is active.
 *
 * CURRENT: MockProvider returns empty URL + simulated cost.
 * FUTURE: Wanxiang/Flux/Midjourney providers return real images.
 */

import type { IPSandboxStep } from "./types";
import type { BrandProfile } from "@/lib/brand-analyzer";
import type { MascotProfile } from "@/agents/mascot-designer";
import type { MascotPromptSet } from "@/lib/mascot-prompt-strategy";
import type { GenerateImageParams } from "@/lib/ip-image-provider/types";
import { getDefaultRegistry } from "@/lib/ip-image-provider/provider";

// ========== Input Types ==========

export interface GenerateStepImageParams {
  step: IPSandboxStep;
  /** Brand name (separate param since BrandProfile doesn't include it) */
  brandName?: string;
  brandProfile: BrandProfile;
  mascotProfile: MascotProfile;
  promptSet: MascotPromptSet;
}

export interface GenerateStepImageResult {
  imageUrl: string;
  actualCost: number;
  durationMs: number;
}

// ========== Mapping Helper ==========

function buildProviderParams(
  params: GenerateStepImageParams
): GenerateImageParams {
  const { step, brandName, brandProfile, mascotProfile, promptSet } = params;

  return {
    brandContext: {
      brandName: brandName || brandProfile.brandPositioning?.split("—")?.[0]?.trim() || "",
      industry: brandProfile.industry || "",
      brandPositioning: brandProfile.brandPositioning || "",
      brandPersona: brandProfile.brandPersona || [],
      visualDirection: brandProfile.visualDirection || "",
    },
    ipProfile: {
      mascotName: mascotProfile.existingMascotName || mascotProfile.suggestedName,
      type: mascotProfile.suggestedType || "character",
      personality: mascotProfile.personality || [],
      visualTraits: mascotProfile.visualTraits || [],
      colorDirection: mascotProfile.colorDirection || [],
    },
    step: {
      stepId: step.stepId,
      label: step.label,
      description: step.label,
    },
    prompt: promptSet.imagePrompt || "",
    negativePrompt: promptSet.negativePrompt || "",
    seedAssetId: step.seedAssetId,
    output: {
      width: 1024,
      height: 1024,
      format: "png",
    },
  };
}

// ========== Provider-Backed Generator ==========

/**
 * Generate a single IP asset image via ProviderRegistry.
 *
 * The registry selects the first available provider:
 *   Wanxiang → Flux → Midjourney → Mock (guaranteed fallback)
 *
 * CURRENT: MockProvider is always available (returns empty URL, cost=10).
 * FUTURE: When Wanxiang API key is configured, it auto-selects Wanxiang.
 */
export async function generateStepImage(
  params: GenerateStepImageParams
): Promise<GenerateStepImageResult> {
  const providerParams = buildProviderParams(params);

  const registry = getDefaultRegistry();
  const provider = await registry.getActive();

  const result = await provider.generateImage(providerParams);

  return {
    imageUrl: result.imageUrl,
    actualCost: result.actualCost,
    durationMs: result.durationMs,
  };
}

/**
 * Regenerate a step with a different variation.
 *
 * CURRENT: Same as generateStepImage.
 * FUTURE: Will call provider.generateVariant() for different seed.
 */
export async function regenerateStepImage(
  params: GenerateStepImageParams
): Promise<GenerateStepImageResult> {
  const providerParams = buildProviderParams(params);

  const registry = getDefaultRegistry();
  const provider = await registry.getActive();

  const result = await provider.generateVariant(providerParams);

  return {
    imageUrl: result.imageUrl,
    actualCost: result.actualCost,
    durationMs: result.durationMs,
  };
}
