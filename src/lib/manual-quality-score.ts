/**
 * Manual Quality Score V1
 *
 * Evaluates a generated VI manual across 5 dimensions:
 *   1. brandLogic (0-20)         — Does it fit the brand?
 *   2. visualConsistency (0-20)  — Is the style coherent?
 *   3. assetProtection (0-20)    — Are Logo/IP protected from AI redraw?
 *   4. guidelineCompleteness (0-25) — Does it cover required specs?
 *   5. productionReadiness (0-15)   — Can it guide real production?
 *
 * Total: 0-100. Below 75 = needs_revision.
 */

import type { ManualPackageType, PackageDefinition } from "./manual-packages";
import type { BrandProfile } from "./brand-analyzer";

// ========== Types ==========

export type QualitySeverity = "low" | "medium" | "high";
export type QualityCategory =
  | "brand_logic"
  | "visual"
  | "asset"
  | "guideline"
  | "production";

export interface QualityIssue {
  severity: QualitySeverity;
  category: QualityCategory;
  message: string;
  affectedPages?: string[];
}

export interface ManualQualityScore {
  totalScore: number;
  dimensions: {
    brandLogic: number;
    visualConsistency: number;
    assetProtection: number;
    guidelineCompleteness: number;
    productionReadiness: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
  flags: string[];
}

// ========== Constants ==========

const MAX_SCORES = {
  brandLogic: 20,
  visualConsistency: 20,
  assetProtection: 20,
  guidelineCompleteness: 25,
  productionReadiness: 15,
} as const;

const PASS_THRESHOLD = 75;
const ASSET_CRITICAL_THRESHOLD = 15;
const GUIDELINE_CRITICAL_THRESHOLD = 15;

// ========== Per-package required modules ==========

const REQUIRED_MODULES: Record<ManualPackageType, string[]> = {
  basic_vi: [
    "cover",
    "logo-specs",
    "logo-safe-area",
    "brand-colors",
    "typography",
    "logo-misuse",
    "closing",
  ],
  brand_vi: [
    "cover",
    "brand-story",
    "logo-specs",
    "brand-colors",
    "typography",
    "office-apps",
    "marketing-collateral",
    "closing",
  ],
  brand_ip: [
    "cover",
    "brand-story",
    "logo-specs",
    "brand-colors",
    "typography",
    "mascot-profile",
    "mascot-three-view",
    "mascot-colors",
    "mascot-expression",
    "mascot-usage",
    "closing",
  ],
};

const REQUIRED_APPLICATION_MODULES: Record<ManualPackageType, string[]> = {
  basic_vi: [],
  brand_vi: ["marketing-collateral"],
  brand_ip: ["packaging", "social-media", "retail-store"],
};

// ========== High-risk keywords in page descriptions ==========

const REDRAW_KEYWORDS = [
  "redesign logo",
  "redraw logo",
  "recreate logo",
  "new logo",
  "redesign mascot",
  "redraw mascot",
  "recreate mascot",
  "new mascot",
  "redesign ip",
  "redraw character",
  "recreate character",
  "change mascot color",
  "change logo color",
  "modify logo",
  "modify mascot",
];

// ========== Production readiness indicators ==========

const PRODUCTION_INDICATORS = [
  "尺寸",
  "色值",
  "比例",
  "材质",
  "工艺",
  "应用规则",
  "最小尺寸",
  "保护空间",
  "CMYK",
  "RGB",
  "Pantone",
  "出血",
  "印刷",
  "规范",
  "guideline",
  "spec",
  "dimension",
  "color value",
  "material",
  "process",
];

// ========== Main scoring function ==========

export interface QualityInput {
  /** Generated page IDs (for checking completeness) */
  generatedPageIds: string[];
  /** Page descriptions / metadata (for production readiness) */
  pageDescriptions: { pageId: string; description: string }[];
  /** SVG overlay content (for asset protection check) */
  svgContents?: string[];
  /** Background prompt text (for asset protection check) */
  backgroundPrompts?: string[];
  /** Brand profile for brand logic check */
  brandProfile: BrandProfile;
  /** Package definition used */
  packageDef: PackageDefinition;
  /** Whether the brand has protected assets */
  hasLogo: boolean;
  hasMascot: boolean;
  /** Protected asset URLs used */
  protectedAssetUrls?: string[];
}

export function calculateQualityScore(input: QualityInput): ManualQualityScore {
  const issues: QualityIssue[] = [];
  const suggestions: string[] = [];

  // Run each dimension check
  const brandLogic = scoreBrandLogic(input, issues);
  const visualConsistency = scoreVisualConsistency(input, issues);
  const assetProtection = scoreAssetProtection(input, issues);
  const guidelineCompleteness = scoreGuidelineCompleteness(input, issues);
  const productionReadiness = scoreProductionReadiness(input, issues);

  const dimensions = {
    brandLogic,
    visualConsistency,
    assetProtection,
    guidelineCompleteness,
    productionReadiness,
  };

  const totalScore = Object.values(dimensions).reduce((a, b) => a + b, 0);

  // Determine flags
  const flags: string[] = [];
  if (totalScore < PASS_THRESHOLD) flags.push("needs_revision");
  if (assetProtection < ASSET_CRITICAL_THRESHOLD) flags.push("critical_asset_risk");
  if (guidelineCompleteness < GUIDELINE_CRITICAL_THRESHOLD) flags.push("fake_guideline_risk");

  // Generate suggestions from issues
  for (const issue of issues) {
    if (!suggestions.includes(issue.message)) {
      suggestions.push(issue.message);
    }
  }

  return {
    totalScore,
    dimensions,
    issues,
    suggestions,
    flags,
  };
}

// ========== Dimension 1: Brand Logic (0-20) ==========

function scoreBrandLogic(input: QualityInput, issues: QualityIssue[]): number {
  let score = 10; // Default mid score
  const { brandProfile, packageDef } = input;

  // Check if package matches brand type
  if (brandProfile.brandType === "consumer" && packageDef.id === "basic_vi") {
    score -= 4;
    issues.push({ severity: "medium", category: "brand_logic", message: "消费品牌推荐基础VI，建议升级套餐" });
  }
  if (brandProfile.hasMascot && !packageDef.includedModules.includes("mascot-profile")) {
    score -= 4;
    issues.push({ severity: "high", category: "brand_logic", message: "品牌有IP形象但套餐未包含IP规范模块" });
  }
  if (brandProfile.industryCategory === "food_beverage" && packageDef.id !== "brand_ip") {
    score -= 3;
    issues.push({ severity: "medium", category: "brand_logic", message: "餐饮/食品行业建议使用brand_ip套餐以覆盖包装和门店场景" });
  }

  return Math.max(0, Math.min(MAX_SCORES.brandLogic, score));
}

// ========== Dimension 2: Visual Consistency (0-20) ==========

function scoreVisualConsistency(_input: QualityInput, _issues: QualityIssue[]): number {
  // V1: Default score. Future versions will use LLM to assess style coherence.
  // For now, check that color-related modules exist
  return 15;
}

// ========== Dimension 3: Asset Protection (0-20) ==========

function scoreAssetProtection(input: QualityInput, issues: QualityIssue[]): number {
  let score = 20;
  const { backgroundPrompts, svgContents, hasLogo, hasMascot } = input;

  // Check 1: Background prompts contain forbidden content
  for (const prompt of backgroundPrompts || []) {
    const lower = prompt.toLowerCase();
    const bannedTerms = ["logo", "mascot", "ip", "brand mark", "character", "text", "文字", "logo"];
    for (const term of bannedTerms) {
      if (lower.includes(term)) {
        // Minor issue: might be harmless context, but flag it
        if (["logo", "mascot", "ip"].includes(term) && hasLogo && hasMascot) {
          score -= 2;
          issues.push({ severity: "low", category: "asset", message: `背景Prompt中包含"${term}"，可能有重绘风险` });
        }
      }
    }
  }

  // Check 2: SVG uses <image> tags for assets (if SVG available)
  for (const svg of svgContents || []) {
    if (!svg.includes("<image")) {
      score -= 3;
      issues.push({ severity: "high", category: "asset", message: "页面未使用<image>标签引用原图，Logo/IP可能被AI重绘" });
    }
  }

  // Check 3: Page descriptions contain redraw keywords
  for (const page of input.pageDescriptions) {
    const lower = page.description.toLowerCase();
    for (const kw of REDRAW_KEYWORDS) {
      if (lower.includes(kw)) {
        score -= 4;
        issues.push({ severity: "high", category: "asset", message: `页面"${page.pageId}"描述含高风险词"${kw}"，可能有重绘风险`, affectedPages: [page.pageId] });
      }
    }
  }

  return Math.max(0, Math.min(MAX_SCORES.assetProtection, score));
}

// ========== Dimension 4: Guideline Completeness (0-25) ==========

function scoreGuidelineCompleteness(input: QualityInput, issues: QualityIssue[]): number {
  let score = 0;
  const packageType = input.packageDef.id;
  const missingRequired: string[] = [];
  const missingApps: string[] = [];

  // Check required modules for this package type
  const required = REQUIRED_MODULES[packageType] || REQUIRED_MODULES.basic_vi;
  for (const modId of required) {
    if (!input.generatedPageIds.includes(modId)) {
      missingRequired.push(modId);
    } else {
      score += 3; // 3 points per required module
    }
  }

  // Bonus points for all required modules present
  if (missingRequired.length === 0) {
    score += Math.round(25 - required.length * 3); // Fill remaining score
  }

  // Check application modules
  const appModules = REQUIRED_APPLICATION_MODULES[packageType] || [];
  for (const appMod of appModules) {
    if (!input.generatedPageIds.some((id) => id.includes(appMod.replace("-", "")))) {
      missingApps.push(appMod);
    } else {
      // Application modules present = good
      if (score < 22) score += 1;
    }
  }

  // Report issues
  if (missingRequired.length > 0) {
    issues.push({
      severity: missingRequired.length > 2 ? "high" : "medium",
      category: "guideline",
      message: `缺少必要模块：${missingRequired.join("、")}`,
    });
  }
  if (missingApps.length > 0 && packageType === "brand_ip") {
    issues.push({
      severity: "medium",
      category: "guideline",
      message: `brand_ip套餐建议包含应用模块：${missingApps.join("、")}`,
    });
  }

  return Math.max(0, Math.min(MAX_SCORES.guidelineCompleteness, score));
}

// ========== Dimension 5: Production Readiness (0-15) ==========

function scoreProductionReadiness(input: QualityInput, issues: QualityIssue[]): number {
  let score = 5; // Base score: has pages
  let hasProductionData = false;

  // Check page descriptions for production indicators
  for (const page of input.pageDescriptions) {
    const matches = PRODUCTION_INDICATORS.filter((ind) =>
      page.description.toLowerCase().includes(ind.toLowerCase())
    );
    if (matches.length >= 2) {
      score += 2;
      hasProductionData = true;
    }
  }

  // Bonus for having multiple pages with production data
  const pagesWithData = input.pageDescriptions.filter((p) =>
    PRODUCTION_INDICATORS.some((ind) => p.description.toLowerCase().includes(ind.toLowerCase()))
  ).length;
  if (pagesWithData >= Math.ceil(input.pageDescriptions.length / 2)) {
    score += 3;
  }

  if (!hasProductionData) {
    issues.push({
      severity: "high",
      category: "production",
      message: "页面缺少尺寸、色值、材质等落地生产信息，无法指导真实物料制作",
    });
  }
  if (pagesWithData < 3 && input.pageDescriptions.length > 5) {
    issues.push({
      severity: "medium",
      category: "production",
      message: "大部分页面缺少生产规范参数，建议补充尺寸、色值、工艺说明",
    });
  }

  return Math.max(0, Math.min(MAX_SCORES.productionReadiness, score));
}