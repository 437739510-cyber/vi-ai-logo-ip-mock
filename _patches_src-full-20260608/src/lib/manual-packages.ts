/**
 * Brand Brain — Package System
 *
 * Defines the three VI manual package tiers and their module mappings.
 *
 * Tiers:
 *   basic_vi   — 基础VI（初创/小微企业）
 *   brand_vi   — 品牌VI（成长型/品牌升级）
 *   brand_ip   — 品牌+IP（消费品牌/连锁/有IP）
 *
 * Each package defines which modules are included by default and
 * which are optionally available.
 */

import type { BrandProfile } from "./brand-analyzer";
import type { BusinessProfile } from "./business-profile";
import { calculateBusinessScore } from "./business-profile";

// ========== Package Tier ==========

export type ManualPackageType = "basic_vi" | "brand_vi" | "brand_ip";

export const PACKAGE_LABELS: Record<ManualPackageType, string> = {
  basic_vi: "基础VI",
  brand_vi: "品牌VI",
  brand_ip: "品牌+IP",
};

export const PACKAGE_DESCRIPTIONS: Record<ManualPackageType, string> = {
  basic_vi: "适合初创企业、小微企业，已有Logo但缺规范的客户。覆盖Logo规范、颜色、字体、错误用法、基础应用。",
  brand_vi: "适合成长型企业、品牌升级、对外招商、销售物料统一。覆盖基础VI + 品牌架构、办公系统、宣传物料。",
  brand_ip: "适合消费品牌、连锁品牌、餐饮饮品、有IP或需要IP的品牌。覆盖品牌VI + IP设定、三视图、场景延展、包装/社媒/门店应用。",
};

// ========== Package Definition ==========

export interface PackageDefinition {
  /** Package identifier */
  id: ManualPackageType;
  /** Human-readable name */
  name: string;
  /** Brief description */
  description: string;
  /** Suitable client types */
  targetClients: string[];
  /** Module IDs included by default */
  includedModules: string[];
  /** Module IDs available as optional add-ons */
  optionalModules: string[];
  /** Estimated page range */
  estimatedPages: [number, number];
  /** Estimated API calls to Tongyi Wanxiang */
  estimatedApiCalls: number;
  /** Estimated generation time in minutes */
  estimatedMinutes: number;
  /** Package highlights */
  features: string[];
}

// ========== Package Definitions ==========

export const PACKAGE_DEFINITIONS: Record<ManualPackageType, PackageDefinition> = {
  // ==================== 基础VI ====================
  basic_vi: {
    id: "basic_vi",
    name: "基础VI",
    description: "品牌视觉识别基础规范",
    targetClients: ["初创企业", "小微企业", "已有Logo但缺规范的客户", "B2B/制造/服务企业"],
    includedModules: [
      "cover",
      "logo-specs",
      "brand-colors",
      "typography",
      "office-apps",
      "closing",
    ],
    optionalModules: [
      "brand-story",
      "marketing-collateral",
    ],
    estimatedPages: [12, 18],
    estimatedApiCalls: 8,
    estimatedMinutes: 8,
    features: [
      "Logo 完整规范（组合/网格/最小尺寸/保护空间/颜色/错误用法）",
      "色彩系统（主色/辅助色/配色原则）",
      "字体系统（中英文/字号层级）",
      "办公应用规范（名片/信纸/PPT）",
      "白底+品牌色，简洁专业",
    ],
  },

  // ==================== 品牌VI ====================
  brand_vi: {
    id: "brand_vi",
    name: "品牌VI",
    description: "完整品牌视觉识别体系",
    targetClients: ["成长型企业", "品牌升级客户", "对外招商企业", "需要统一销售物料的客户"],
    includedModules: [
      "cover",
      "brand-story",
      "logo-specs",
      "brand-colors",
      "typography",
      "office-apps",
      "marketing-collateral",
      "social-media",
      "digital-products",
      "closing",
    ],
    optionalModules: [
      "packaging",
      "retail-store",
      "event-exhibition",
    ],
    estimatedPages: [18, 30],
    estimatedApiCalls: 12,
    estimatedMinutes: 12,
    features: [
      "基础VI全部内容",
      "品牌架构与联合署名规范",
      "海报/资料封面/社交头像规范",
      "宣传物料系统",
      "数字媒体规范",
      "品牌故事与核心理念",
    ],
  },

  // ==================== 品牌+IP ====================
  brand_ip: {
    id: "brand_ip",
    name: "品牌+IP",
    description: "包含IP形象的完整品牌视觉体系",
    targetClients: ["消费品牌", "连锁品牌", "餐饮饮品", "有IP或需要IP的品牌"],
    includedModules: [
      "cover",
      "brand-story",
      "logo-specs",
      "brand-colors",
      "typography",
      "ip-specs",
      "packaging",
      "retail-store",
      "social-media",
      "marketing-collateral",
      "office-apps",
      "closing",
    ],
    optionalModules: [
      "event-exhibition",
      "signage-wayfinding",
      "digital-products",
    ],
    estimatedPages: [30, 50],
    estimatedApiCalls: 16,
    estimatedMinutes: 16,
    features: [
      "品牌VI全部内容",
      "IP形象完整规范（标准姿态/三视图/表情系统）",
      "IP场景延展与物料应用",
      "产品包装系统",
      "线下门店/招商应用",
      "社媒内容系统",
      "受保护品牌资产（Logo+IP）",
    ],
  },
};

// ========== Recommendation Logic ==========

export interface PackageRecommendation {
  /** Recommended package tier */
  recommended: PackageDefinition;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Alternative packages with reasons */
  alternatives: { package: PackageDefinition; reason: string }[];
}

const PACKAGE_ORDER: ManualPackageType[] = ["basic_vi", "brand_vi", "brand_ip"];

/**
 * Determine the recommended package tier based on brand profile.
 */
export function recommendPackage(profile: BrandProfile): PackageRecommendation {
  const scores: Record<ManualPackageType, number> = {
    basic_vi: 0,
    brand_vi: 0,
    brand_ip: 0,
  };

  // === Scoring factors (each adds to the tier's score) ===

  // Factor 1: Has IP mascot → strongly favors brand_ip
  if (profile.hasMascot) {
    scores.brand_ip += 40;
    scores.brand_vi += 10; // brand_vi can work but not ideal
  }

  // Factor 2: Has Logo → basic_vi minimum
  if (profile.hasLogo) {
    scores.basic_vi += 20;
    scores.brand_vi += 15;
    scores.brand_ip += 10;
  }

  // Factor 3: Brand type
  if (
    profile.brandType === "consumer" ||
    profile.brandType === "hospitality" ||
    profile.brandType === "retail"
  ) {
    scores.brand_vi += 20;
    scores.brand_ip += 30; // Consumer brands benefit most from IP/full system
  }

  if (profile.brandType === "technology") {
    scores.brand_vi += 25;
    scores.basic_vi += 5;
  }

  if (profile.brandType === "industrial" || profile.brandType === "service") {
    scores.basic_vi += 25;
    scores.brand_vi += 10;
  }

  // Factor 4: Industry category
  if (profile.industryCategory === "food_beverage") {
    scores.brand_ip += 25; // Food/beverage needs packaging + retail
    scores.brand_vi += 15;
  }

  if (profile.industryCategory === "technology_it") {
    scores.brand_vi += 15;
  }

  // Factor 5: Brand persona keywords
  if (profile.brandPersona.includes("匠心") || profile.brandPersona.includes("精致")) {
    scores.brand_vi += 10;
    scores.brand_ip += 5;
  }

  // Factor 6: Differentiators count (more content → bigger package)
  const diffCount = profile.differentiators?.length || 0;
  if (diffCount >= 3) {
    scores.brand_vi += 10;
    scores.brand_ip += 15;
  }

  // Factor 7: Target audience keywords
  const audience = profile.targetAudience || "";
  if (audience.includes("连锁") || audience.includes("加盟") || audience.includes("门店")) {
    scores.brand_ip += 20;
  }
  if (audience.includes("高端") || audience.includes("企业")) {
    scores.brand_vi += 10;
  }

  // Determine best tier
  const sorted = PACKAGE_ORDER.map((tier) => ({
    tier,
    score: scores[tier],
    def: PACKAGE_DEFINITIONS[tier],
  })).sort((a, b) => b.score - a.score);

  const top = sorted[0];
  const runnerUp = sorted[1];

  // Build reason
  const reasons: string[] = [];
  if (profile.hasMascot) {
    reasons.push("品牌拥有IP形象");
  }
  if (profile.hasLogo) {
    reasons.push("已有Logo");
  }
  if (profile.brandType === "consumer") {
    reasons.push("消费品牌需要完整视觉体系");
  }
  if (profile.industryCategory === "food_beverage") {
    reasons.push("餐饮/食品行业涉及包装、门店、社媒等多场景");
  }
  if (reasons.length === 0) {
    reasons.push("基于品牌基础信息推荐");
  }

  return {
    recommended: top.def,
    confidence: Math.min(1, top.score / 100),
    reason: reasons.join("；"),
    alternatives: [runnerUp].map((a) => ({
      package: a.def,
      reason: `备选方案（评分差 ${top.score - a.score} 分）`,
    })),
  };
}

/**
 * Get all available packages for reference.
 */


/**
 * Combined recommendation: BrandProfile + BusinessProfile.
 * Business score contributes 40% of the final decision.
 */
export function recommendPackageWithBusiness(
  profile: BrandProfile,
  business: BusinessProfile
): PackageRecommendation {
  // Get brand-side recommendation
  const brandRec = recommendPackage(profile);

  // Get business-side scores
  const bizScore = calculateBusinessScore(business);

  // Combined scores: 60% brand + 40% business
  const PACKAGE_ORDER: ManualPackageType[] = ["basic_vi", "brand_vi", "brand_ip"];
  const combined: { tier: ManualPackageType; score: number; def: PackageDefinition }[] = PACKAGE_ORDER.map((tier) => {
    // Extract brand score from the original scoring logic by re-running internally
    // We re-use recommendPackage which has internal scoring
    const brandScore = getBrandScoreForPackage(profile, tier);
    const biz = bizScore.scores[tier];
    const finalScore = brandScore * 0.6 + biz * 0.4;
    return { tier, score: finalScore, def: PACKAGE_DEFINITIONS[tier] };
  });

  const sorted = combined.sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const runnerUp = sorted[1];

  // Build reason combining brand and business factors
  const reasons: string[] = [];
  reasons.push(brandRec.reason);
  reasons.push(`业务判断：${getBusinessStageLabel(business.businessStage)}，目标：${getBusinessGoalLabel(business.businessGoal)}，预算：${getBudgetLabel(business.budgetLevel)}`);

  return {
    recommended: top.def,
    confidence: Math.min(1, top.score / 100),
    reason: reasons.join("；"),
    alternatives: [runnerUp].map((a) => ({
      package: a.def,
      reason: `备选方案（评分差 ${(top.score - a.score).toFixed(0)} 分）`,
    })),
  };
}

/** Extract brand-side score for a specific package tier */
function getBrandScoreForPackage(profile: BrandProfile, tier: ManualPackageType): number {
  let score = 0;
  if (profile.hasMascot) { score += tier === "brand_ip" ? 40 : tier === "brand_vi" ? 10 : 0; }
  if (profile.hasLogo) { score += tier === "basic_vi" ? 20 : tier === "brand_vi" ? 15 : 10; }
  if (profile.brandType === "consumer" || profile.brandType === "hospitality" || profile.brandType === "retail") {
    score += tier === "brand_vi" ? 20 : tier === "brand_ip" ? 30 : 0;
  }
  if (profile.brandType === "technology") { score += tier === "brand_vi" ? 25 : tier === "basic_vi" ? 5 : 0; }
  if (profile.brandType === "industrial" || profile.brandType === "service") {
    score += tier === "basic_vi" ? 25 : tier === "brand_vi" ? 10 : 0;
  }
  if (profile.industryCategory === "food_beverage") { score += tier === "brand_ip" ? 25 : tier === "brand_vi" ? 15 : 0; }
  if (profile.industryCategory === "technology_it") { score += tier === "brand_vi" ? 15 : 0; }
  const diffCount = profile.differentiators?.length || 0;
  if (diffCount >= 3) { score += tier === "brand_vi" ? 10 : tier === "brand_ip" ? 15 : 0; }
  return score;
}

function getBusinessStageLabel(s: string): string {
  const m: Record<string, string> = { startup: "初创品牌", growth: "成长品牌", chain: "连锁品牌", enterprise: "企业级品牌" };
  return m[s] || s;
}
function getBusinessGoalLabel(g: string): string {
  const m: Record<string, string> = { branding: "建立品牌基础", packaging: "产品包装升级", franchise: "招商加盟", marketing: "营销推广" };
  return m[g] || g;
}
function getBudgetLabel(b: string): string {
  const m: Record<string, string> = { basic: "轻量版", standard: "标准版", premium: "高级版" };
  return m[b] || b;
}


export function getAllPackages(): PackageDefinition[] {
  return PACKAGE_ORDER.map((tier) => PACKAGE_DEFINITIONS[tier]);
}
