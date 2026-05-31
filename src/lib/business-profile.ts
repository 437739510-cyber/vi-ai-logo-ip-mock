/**
 * Business Profile V1
 *
 * Captures the client's business context to refine package recommendations.
 * BrandProfile answers "what brand is this?"
 * BusinessProfile answers "what does this client need right now?"
 */

export type BusinessStage = "startup" | "growth" | "chain" | "enterprise";
export type BusinessGoal = "branding" | "packaging" | "franchise" | "marketing";
export type BudgetLevel = "basic" | "standard" | "premium";

export interface BusinessProfile {
  businessStage: BusinessStage;
  businessGoal: BusinessGoal;
  budgetLevel: BudgetLevel;
}

// ====== User-facing labels ======

export const BUSINESS_STAGE_LABELS: Record<BusinessStage, string> = {
  startup: "初创品牌",
  growth: "成长品牌",
  chain: "连锁品牌",
  enterprise: "企业级品牌",
};

export const BUSINESS_GOAL_LABELS: Record<BusinessGoal, string> = {
  branding: "建立品牌基础",
  packaging: "产品包装升级",
  franchise: "招商加盟",
  marketing: "营销推广",
};

export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  basic: "轻量版",
  standard: "标准版",
  premium: "高级版",
};

// ====== Business score for package recommendation ======

import type { ManualPackageType } from "./manual-packages";

export interface BusinessScoreResult {
  scores: Record<ManualPackageType, number>;
  breakdown: {
    stage: Record<ManualPackageType, number>;
    goal: Record<ManualPackageType, number>;
    budget: Record<ManualPackageType, number>;
  };
  total: number;
}

/**
 * Calculate the business-side score for each package tier.
 * This is combined with the brand-side score at a 40/60 ratio.
 */
export function calculateBusinessScore(business: BusinessProfile): BusinessScoreResult {
  const PACKAGES: ManualPackageType[] = ["basic_vi", "brand_vi", "brand_ip"];

  // Stage scores
  const stageScores: Record<string, Record<ManualPackageType, number>> = {
    startup:   { basic_vi: 15, brand_vi: 5,  brand_ip: 0 },
    growth:    { basic_vi: 5,  brand_vi: 20, brand_ip: 10 },
    chain:     { basic_vi: 0,  brand_vi: 10, brand_ip: 30 },
    enterprise:{ basic_vi: 0,  brand_vi: 20, brand_ip: 15 },
  };

  // Goal scores
  const goalScores: Record<string, Record<ManualPackageType, number>> = {
    branding:  { basic_vi: 15, brand_vi: 20, brand_ip: 10 },
    packaging: { basic_vi: 0,  brand_vi: 10, brand_ip: 25 },
    franchise: { basic_vi: 0,  brand_vi: 15, brand_ip: 25 },
    marketing: { basic_vi: 5,  brand_vi: 20, brand_ip: 15 },
  };

  // Budget scores
  const budgetScores: Record<string, Record<ManualPackageType, number>> = {
    basic:    { basic_vi: 15, brand_vi: 5,  brand_ip: 0 },
    standard: { basic_vi: 5,  brand_vi: 20, brand_ip: 10 },
    premium:  { basic_vi: 0,  brand_vi: 10, brand_ip: 25 },
  };

  const stage = stageScores[business.businessStage] || stageScores.startup;
  const goal = goalScores[business.businessGoal] || goalScores.branding;
  const budget = budgetScores[business.budgetLevel] || budgetScores.basic;

  const scores: Record<ManualPackageType, number> = { basic_vi: 0, brand_vi: 0, brand_ip: 0 };
  const breakdown = { stage: {} as Record<ManualPackageType, number>, goal: {} as Record<ManualPackageType, number>, budget: {} as Record<ManualPackageType, number> };

  for (const pkg of PACKAGES) {
    breakdown.stage[pkg] = stage[pkg];
    breakdown.goal[pkg] = goal[pkg];
    breakdown.budget[pkg] = budget[pkg];
    scores[pkg] = stage[pkg] + goal[pkg] + budget[pkg];
  }

  return {
    scores,
    breakdown,
    total: Object.values(scores).reduce((a, b) => a + b, 0),
  };
}