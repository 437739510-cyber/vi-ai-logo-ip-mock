/**
 * Wanxiang Cost Estimation
 *
 * Maps Wanxiang models to credit costs.
 * 1 credit = 0.001 RMB (approximately)
 *
 * These values are based on published DashScope pricing
 * and should be verified against actual billing.
 */

// ========== Model Cost Map ==========

const MODEL_COST_MAP: Record<string, number> = {
  "wanx2.1-t2i-turbo": 80,  // ~0.08 RMB per image
  "wanx2.1-t2i-plus":  200, // ~0.20 RMB per image
};

const DEFAULT_COST = 80; // Fallback to turbo pricing

// ========== Public API ==========

/**
 * Estimate cost for generating a single image with the given model.
 */
export function estimateWanxiangCost(
  model: string,
  quantity: number = 1
): number {
  const unitCost = MODEL_COST_MAP[model] || DEFAULT_COST;
  return unitCost * quantity;
}

/**
 * Get the unit credit cost for a specific model.
 */
export function getWanxiangUnitCost(model: string): number {
  return MODEL_COST_MAP[model] || DEFAULT_COST;
}

/**
 * Get all supported models with their costs.
 */
export function getWanxiangModels(): Array<{ model: string; costPerImage: number }> {
  return Object.entries(MODEL_COST_MAP).map(([model, cost]) => ({
    model,
    costPerImage: cost,
  }));
}

/**
 * Estimate cost for a full IP asset sequence.
 *
 * Accepts an array of step labels; maps each to the appropriate model
 * and sums the total credits.
 */
export function estimateWanxiangSequenceCost(
  steps: Array<{ stepId: string; label: string; quantity?: number }>
): {
  totalCredits: number;
  breakdown: Array<{ stepId: string; label: string; model: string; credits: number }>;
} {
  // Model selection logic mirrors WanxiangProvider.selectModel()
  function selectModel(stepId: string): string {
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
    if (
      stepId.includes("packaging") ||
      stepId.includes("scene") ||
      stepId.includes("store")
    ) {
      return "wanx2.1-t2i-plus";
    }
    return "wanx2.1-t2i-turbo";
  }

  const breakdown = steps.map((step) => {
    const model = selectModel(step.stepId);
    const quantity = step.quantity || 1;
    const unitCost = MODEL_COST_MAP[model] || DEFAULT_COST;
    return {
      stepId: step.stepId,
      label: step.label,
      model,
      credits: unitCost * quantity,
    };
  });

  const totalCredits = breakdown.reduce((sum, s) => sum + s.credits, 0);

  return { totalCredits, breakdown };
}
