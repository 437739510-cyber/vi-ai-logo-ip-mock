/**
 * Brand Brain V1 — Module Planner
 *
 * V2: Added score (0-100) for flexible sorting. Priority retained for UI display.
 *
 * Takes a BrandProfile (from Brand Analyzer) and an IndustryProfile
 * (from Industry Knowledge) and produces a set of recommended VI manual
 * modules / pages, tailored to the brand's specific characteristics.
 *
 * This is the bridge between "who is the brand" and "what pages to generate".
 */

import type { BrandProfile } from "./brand-analyzer";
import { recommendPackage, type PackageRecommendation } from "./manual-packages";
import { getProfileForBrand, type IndustryProfile } from "./industry-knowledge";

export interface RecommendedModule {
  id: string;
  label: string;
  description: string;
  priority: "essential" | "recommended" | "optional";
  /** V2: Score 0-100 for flexible sorting. Priority is for display only. */
  score: number;
  estimatedPages: number;
  reason: string;
  protectedAssets?: string[];
}

export interface ModulePlan {
  profile: BrandProfile;
  industryProfile: IndustryProfile;
  modules: RecommendedModule[];
  totalEstimatedPages: number;
  pageRange: [number, number];
  summary: string;
  /** Package recommendation */
  packageRecommendation: import("./manual-packages").PackageRecommendation;
}

interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  basePriority: "essential" | "recommended" | "optional";
  baseScore: number;          // V2: base score 0-100
  basePages: number;
  boostConditions: ((profile: BrandProfile) => boolean)[];
  getReason: (profile: BrandProfile) => string;
  protectedAssets?: string[];
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "cover",
    label: "封面",
    description: "VI手册封面，展示品牌名称、Logo和IP形象",
    basePriority: "essential",
    baseScore: 100,
    basePages: 1,
    boostConditions: [],
    getReason: () => "所有VI手册都需要的封面页",
    protectedAssets: ["logo", "mascot"],
  },
  {
    id: "brand-story",
    label: "品牌故事",
    description: "品牌愿景、使命、核心价值与发展历程",
    basePriority: "essential",
    baseScore: 90,
    basePages: 1,
    boostConditions: [
      (p) => p.brandPersona.includes("匠心"),
      (p) => p.analysis.brandVisionKeywords.length > 3,
    ],
    getReason: (p) => {
      if (p.brandPersona.includes("匠心")) return "匠心品牌需要完整传达品牌故事和工艺传承";
      return "帮助受众理解品牌起源与核心理念";
    },
  },
  {
    id: "logo-specs",
    label: "Logo规范",
    description: "标准Logo、组合规范、最小尺寸、保护空间、错误用法",
    basePriority: "essential",
    baseScore: 95,
    basePages: 2,
    boostConditions: [
      (p) => p.hasLogo,
      (p) => p.analysis.brandVisionKeywords.length > 0,
    ],
    getReason: () => "Logo是品牌最核心的视觉资产，需要完整规范",
    protectedAssets: ["logo"],
  },
  {
    id: "brand-colors",
    label: "品牌色彩系统",
    description: "主色、辅助色、强调色及应用规范",
    basePriority: "essential",
    baseScore: 90,
    basePages: 2,
    boostConditions: [],
    getReason: () => "色彩系统是品牌识别的基础",
  },
  {
    id: "typography",
    label: "字体系统",
    description: "中英文字体规范、字号层级、应用规则",
    basePriority: "essential",
    baseScore: 85,
    basePages: 2,
    boostConditions: [],
    getReason: () => "统一字体系统确保品牌传达的一致性",
  },
  {
    id: "ip-specs",
    label: "IP形象规范",
    description: "IP公仔标准姿态、表情、应用规则与保护规范",
    basePriority: "recommended",
    baseScore: 50,
    basePages: 2,
    boostConditions: [
      (p) => p.hasMascot,
    ],
    getReason: () => "品牌拥有IP公仔，需建立完整IP使用规范以避免滥用",
    protectedAssets: ["mascot"],
  },
  {
    id: "packaging",
    label: "产品包装系统",
    description: "产品包装设计规范与版式示例",
    basePriority: "recommended",
    baseScore: 60,
    basePages: 2,
    boostConditions: [
      (p) => p.brandType === "consumer" || p.brandType === "retail" || p.brandType === "hospitality",
      (p) => p.industryCategory === "food_beverage",
    ],
    getReason: (p) => {
      if (p.industryCategory === "food_beverage") return "食品饮料品牌的产品包装是品牌与消费者的第一触达点";
      return "产品包装是品牌的重要接触点";
    },
  },
  {
    id: "retail-store",
    label: "线下门店系统",
    description: "门店空间设计、陈列规范、导视系统",
    basePriority: "recommended",
    baseScore: 55,
    basePages: 2,
    boostConditions: [
      (p) => p.brandType === "hospitality" || p.brandType === "retail",
      (p) => p.industryCategory === "food_beverage",
    ],
    getReason: () => "餐饮/零售品牌的门店体验是最重要的品牌触点之一",
  },
  {
    id: "social-media",
    label: "社媒内容系统",
    description: "社交媒体封面、内容模板、视觉规范",
    basePriority: "recommended",
    baseScore: 55,
    basePages: 2,
    boostConditions: [
      (p) => p.brandType === "consumer" || p.brandType === "retail",
      (p) => !!(p.targetAudience && (p.targetAudience.includes("博主") || p.targetAudience.includes("年轻") || p.targetAudience.includes("线上"))),
    ],
    getReason: () => "社媒内容是消费品牌与用户互动的主要渠道",
  },
  {
    id: "office-apps",
    label: "办公应用系统",
    description: "名片、信封、PPT模板、邮件签名等办公物料规范",
    basePriority: "recommended",
    baseScore: 45,
    basePages: 2,
    boostConditions: [
      (p) => p.brandType === "service" || p.brandType === "technology",
    ],
    getReason: () => "办公物料是品牌日常对外输出的高频触点",
  },
  {
    id: "digital-products",
    label: "数字产品界面规范",
    description: "网站/App UI组件、数字广告规范",
    basePriority: "optional",
    baseScore: 30,
    basePages: 2,
    boostConditions: [
      (p) => p.brandType === "technology",
      (p) => p.industryCategory === "technology_it",
    ],
    getReason: () => "科技品牌的数字产品界面需要与品牌视觉统一",
  },
  {
    id: "marketing-collateral",
    label: "宣传物料系统",
    description: "宣传册、海报、展会物料等应用规范",
    basePriority: "recommended",
    baseScore: 40,
    basePages: 1,
    boostConditions: [
      (p) => p.industryCategory === "manufacturing" || p.industryCategory === "culture_media",
    ],
    getReason: () => "线下宣传物料是品牌展示实力的重要窗口",
  },
  {
    id: "signage-wayfinding",
    label: "空间导视系统",
    description: "室内外标识、指引系统、环境图形规范",
    basePriority: "optional",
    baseScore: 25,
    basePages: 2,
    boostConditions: [
      (p) => p.industryCategory === "hospitality_tourism" || p.industryCategory === "real_estate",
      (p) => p.brandType === "hospitality",
    ],
    getReason: () => "酒店/旅游品牌的空间体验是品牌的核心组成部分",
  },
  {
    id: "event-exhibition",
    label: "展会/活动视觉规范",
    description: "展台设计、活动物料、赞助视觉规范",
    basePriority: "optional",
    baseScore: 20,
    basePages: 1,
    boostConditions: [
      (p) => p.industryCategory === "culture_media" || p.industryCategory === "manufacturing",
    ],
    getReason: () => "展会和活动是行业品牌展示专业形象的关键场合",
  },
  {
    id: "closing",
    label: "感谢/封底",
    description: "VI手册封底，含联系方式与版权信息",
    basePriority: "essential",
    baseScore: 90,
    basePages: 1,
    boostConditions: [],
    getReason: () => "VI手册结束页，展示品牌联系方式",
    protectedAssets: ["logo", "mascot"],
  },
];

function computeScore(def: ModuleDefinition, profile: BrandProfile): number {
  let score = def.baseScore;
  const boostCount = def.boostConditions.filter((c) => c(profile)).length;
  // Each boost adds 15 points, capped at 100
  score += boostCount * 15;
  return Math.min(100, Math.max(0, score));
}

function computePriority(
  _def: ModuleDefinition,
  _profile: BrandProfile,
  score: number
): "essential" | "recommended" | "optional" {
  if (score >= 80) return "essential";
  if (score >= 40) return "recommended";
  return "optional";
}

/**
 * Generate a complete module plan for a brand profile.
 */
export function planModules(profile: BrandProfile): ModulePlan {
  const industryProfile = getProfileForBrand(profile);

  const modules: RecommendedModule[] = MODULE_DEFINITIONS.map((def) => {
    const score = computeScore(def, profile);
    const priority = computePriority(def, profile, score);
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      priority,
      score,
      estimatedPages: def.basePages,
      reason: def.getReason(profile),
      protectedAssets: def.protectedAssets,
    };
  })
    // Sort by score descending (highest priority first)
    .sort((a, b) => b.score - a.score);

  const totalEstimatedPages = modules.reduce((sum, m) => sum + m.estimatedPages, 0);

  const essentialModules = modules.filter((m) => m.priority === "essential");
  const totalEssentialPages = essentialModules.reduce((sum, m) => sum + m.estimatedPages, 0);

  const summary = generateSummary(profile, modules, totalEstimatedPages);

  const pkgRec = recommendPackage(profile);

  return {
    profile,
    industryProfile,
    modules,
    totalEstimatedPages,
    pageRange: [
      Math.max(8, totalEssentialPages),
      Math.max(totalEstimatedPages, industryProfile.recommendedPageRange[0]),
    ] as [number, number],
    summary,
    packageRecommendation: pkgRec,
  };
}

function generateSummary(
  profile: BrandProfile,
  modules: RecommendedModule[],
  totalPages: number
): string {
  const essential = modules.filter((m) => m.priority === "essential");
  const recommended = modules.filter((m) => m.priority === "recommended");
  const optional = modules.filter((m) => m.priority === "optional");

  const parts: string[] = [
    `${profile.industry}品牌`,
    `人格：${profile.brandPersona.join("、")}`,
  ];

  parts.push(`推荐 ${essential.length} 个核心模块 + ${recommended.length} 个推荐模块`);
  parts.push(`预估共 ${totalPages} 页`);

  return parts.join(" · ");
}
