/**
 * Brand Brain V1 — Brand Analyzer
 *
 * Analyzes brand data (clientInfo / submission) and produces a structured
 * BrandProfile that captures brand type, personality, industry category,
 * protected assets, and strategic positioning.
 *
 * V2: Added brandPositioning, brandVoice, brandArchetype
 */

import { scanMultipleFields, type KeywordMatchResult } from "./brand-dictionary";

export interface BrandProfile {
  /** Primary brand archetype / category */
  brandType: BrandType;
  confidence: number;

  /** Brand personality traits (3-5 keywords) */
  brandPersona: string[];

  /** Industry classification (mapped from raw input) */
  industry: string;
  industryCategory: IndustryCategory;

  /** Whether the brand has protected assets */
  hasLogo: boolean;
  hasMascot: boolean;
  logoCount: number;
  mascotCount: number;

  /** Strategic brand stage */
  brandStage: BrandStage;

  /** Target audience summary */
  targetAudience: string;

  /** Key differentiators extracted from brand copy */
  differentiators: string[];

  /** Inferred visual style direction */
  visualDirection: VisualDirection;

  // ===== V2新增字段 =====

  /** 品牌定位语（一句话） */
  brandPositioning: string;

  /** 品牌语气/调性 */
  brandVoice: string[];

  /** 品牌原型（参考：Hero / Explorer / Caregiver / Creator / Sage / Innocent） */
  brandArchetype: string;

  // =====================

  /** Raw analysis metadata */
  analysis: {
    brandVisionKeywords: string[];
    coreValueKeywords: string[];
    marketKeywords: string[];
  };
}

export type BrandType =
  | "consumer"       // 消费品牌
  | "technology"     // 科技品牌
  | "service"        // 服务品牌
  | "lifestyle"      // 生活方式品牌
  | "industrial"     // 工业/制造品牌
  | "cultural"       // 文化/传媒品牌
  | "healthcare"     // 医疗健康品牌
  | "education"      // 教育品牌
  | "retail"         // 零售品牌
  | "hospitality"    // 酒店/餐饮品牌
  | "unknown" | "finance_legal";

export type IndustryCategory =
  | "food_beverage"
  | "technology_it"
  | "retail_ecommerce"
  | "education_training"
  | "healthcare_medical"
  | "finance_legal"
  | "culture_media"
  | "manufacturing"
  | "hospitality_tourism"
  | "real_estate"
  | "other";

export type BrandStage =
  | "startup"
  | "growth"
  | "mature"
  | "rebranding"
  | "unknown";  // V2: 允许 unknown，不强猜

export type VisualDirection =
  | "natural_organic"
  | "minimal_modern"
  | "bold_energetic"
  | "luxury_premium"
  | "tech_futuristic"
  | "warm_friendly"
  | "professional_trust"
  | "cultural_heritage"
  | "playful_youthful";

/** Known keyword → brand-type mappings */
const BRAND_TYPE_KEYWORDS: Record<string, BrandType> = {
  椰子: "consumer",
  饮品: "consumer",
  食品: "consumer",
  餐饮: "hospitality",
  茶: "consumer",
  咖啡: "consumer",
  果汁: "consumer",
  零食: "consumer",
  健康: "healthcare",
  科技: "technology",
  互联网: "technology",
  软件: "technology",
  AI: "technology",
  人工智能: "technology",
  数据: "technology",
  咨询: "service",
  服务: "service",
  设计: "service",
  广告: "service",
  生活: "lifestyle",
  家居: "lifestyle",
  时尚: "lifestyle",
  美学: "lifestyle",
  制造: "industrial",
  工业: "industrial",
  教育: "education",
  培训: "education",
  金融: "finance_legal",
  法律: "finance_legal",
  医疗: "healthcare",
};

/** Industry → IndustryCategory mapping */
const INDUSTRY_CATEGORY_MAP: Record<string, IndustryCategory> = {
  "餐饮/食品": "food_beverage",
  "科技/互联网": "technology_it",
  "零售/电商": "retail_ecommerce",
  "教育/培训": "education_training",
  "医疗/健康": "healthcare_medical",
  "金融/法律": "finance_legal",
  "文化/传媒": "culture_media",
  "制造业": "manufacturing",
};

/** Key persona-generating keywords (fallback when dictionary is insufficient) */
const PERSONA_KEYWORD_MAP: Record<string, string[]> = {
  自然: ["自然", "天然", "有机", "绿色", "生态", "纯净", "新鲜"],
  阳光: ["阳光", "热带", "温暖", "活力", "热情"],
  健康: ["健康", "活力", "专业", "科学", "营养"],
  专业: ["专业", "权威", "信赖", "可靠", "精准"],
  创新: ["创新", "突破", "未来", "前沿", "科技"],
  精致: ["精致", "优雅", "高端", "品位", "奢华"],
  温暖: ["温暖", "亲切", "友好", "关怀", "陪伴"],
  潮流: ["潮流", "时尚", "个性", "年轻", "前卫"],
  匠心: ["匠心", "品质", "专注", "传承", "经典"],
};

/** Persona → brand archetype mapping */
const PERSONA_TO_ARCHETYPE: Record<string, string> = {
  自然: "innocent",      // 纯真者 — 自然、纯净、简单
  阳光: "explorer",      // 探索者 — 自由、冒险、热带
  健康: "caregiver",     // 关怀者 — 健康、照顾、滋养
  专业: "sage",          // 智者 — 专业、智慧、权威
  创新: "creator",       // 创造者 — 创新、突破、革新
  精致: "ruler",         // 统治者 — 精致、高端、掌控
  温暖: "regular_guy",   // 普通人 — 温暖、亲切、真实
  潮流: "outlaw",        // 反叛者 — 潮流、个性、颠覆
  匠心: "sage",          // 智者 — 匠心、品质、传承
};

/** Persona → brand voice mapping */
const PERSONA_TO_VOICE: Record<string, string[]> = {
  自然: ["warm", "authentic", "simple"],
  阳光: ["energetic", "friendly", "playful"],
  健康: ["caring", "inspiring", "trustworthy"],
  专业: ["professional", "authoritative", "precise"],
  创新: ["bold", "visionary", "confident"],
  精致: ["refined", "sophisticated", "exclusive"],
  温暖: ["friendly", "approachable", "empathetic"],
  潮流: ["edgy", "trendy", "rebellious"],
  匠心: ["dedicated", "heritage", "detailed"],
};

function inferBrandType(
  companyName: string,
  industry: string,
  brandVision: string,
  logoPhilosophy: string,
  dictionaryResult?: KeywordMatchResult
): { brandType: BrandType; confidence: number } {
  if (dictionaryResult && dictionaryResult.matchedIndustryHints.length > 0) {
    const topHint = dictionaryResult.matchedIndustryHints[0];
    const typeMap: Record<string, BrandType> = {
      food_beverage: "consumer",
      technology_it: "technology",
      retail_ecommerce: "retail",
      education_training: "education",
      healthcare_medical: "healthcare",
      finance_legal: "service",
      culture_media: "cultural",
      manufacturing: "industrial",
      hospitality_tourism: "hospitality",
    };
    const mapped = typeMap[topHint];
    if (mapped) return { brandType: mapped, confidence: 0.75 };
  }

  const allText = [companyName, industry, brandVision, logoPhilosophy].join(" ");
  for (const [keyword, type] of Object.entries(BRAND_TYPE_KEYWORDS)) {
    if (allText.includes(keyword)) {
      return { brandType: type, confidence: 0.7 };
    }
  }

  if (industry.includes("餐饮") || industry.includes("食品")) {
    return { brandType: "hospitality", confidence: 0.6 };
  }
  if (industry.includes("科技") || industry.includes("互联网")) {
    return { brandType: "technology", confidence: 0.6 };
  }
  if (industry.includes("零售") || industry.includes("电商")) {
    return { brandType: "retail", confidence: 0.6 };
  }

  return { brandType: "unknown", confidence: 0.3 };
}

function inferBrandPersona(
  brandVision: string,
  coreValues: string,
  mascotPhilosophy: string,
  dictionaryCategories: string[]
): string[] {
  if (dictionaryCategories.length >= 3) {
    return dictionaryCategories.slice(0, 6);
  }

  const allText = [brandVision, coreValues, mascotPhilosophy].join(" ");
  const matched = [...dictionaryCategories];

  for (const [persona, keywords] of Object.entries(PERSONA_KEYWORD_MAP)) {
    if (matched.includes(persona)) continue;
    for (const kw of keywords) {
      if (allText.includes(kw)) {
        matched.push(persona);
        break;
      }
    }
  }

  return [...new Set(matched)].slice(0, 6);
}

function inferBrandStage(_clientInfo: any): BrandStage {
  // V2: 没有足够数据时不强猜
  return "unknown";
}

function inferBrandArchetype(brandPersona: string[]): string {
  for (const persona of brandPersona) {
    const archetype = PERSONA_TO_ARCHETYPE[persona];
    if (archetype) return archetype;
  }
  return "regular_guy"; // 默认：普通人
}

function inferBrandVoice(brandPersona: string[]): string[] {
  const voices = new Set<string>();
  for (const persona of brandPersona) {
    const mapped = PERSONA_TO_VOICE[persona];
    if (mapped) mapped.forEach((v) => voices.add(v));
  }
  return [...voices].slice(0, 5);
}

function inferBrandPositioning(
  companyName: string,
  brandVision: string,
  industry: string,
  brandType: BrandType
): string {
  // Try to extract a positioning statement from brandVision
  if (brandVision) {
    // Take the first meaningful clause
    const firstClause = brandVision.split(/[，,。]/).filter((s) => s.trim().length >= 8);
    if (firstClause.length > 0) return firstClause[0].trim();
  }

  // Fallback: company name + industry
  const industryLabel: Record<string, string> = {
    consumer: "消费品牌",
    hospitality: "餐饮品牌",
    technology: "科技品牌",
    healthcare: "健康品牌",
  };
  return `${companyName} — ${industryLabel[brandType] || "品牌"}`;
}

function inferVisualDirection(
  _brandType: BrandType,
  brandPersona: string[]
): VisualDirection {
  if (brandPersona.includes("自然")) return "natural_organic";
  if (brandPersona.includes("创新")) return "tech_futuristic";
  if (brandPersona.includes("精致")) return "luxury_premium";
  if (brandPersona.includes("潮流") || brandPersona.includes("阳光")) return "bold_energetic";
  if (brandPersona.includes("温暖")) return "warm_friendly";
  if (brandPersona.includes("专业")) return "professional_trust";
  if (brandPersona.includes("匠心")) return "cultural_heritage";
  return "minimal_modern";
}

function extractDifferentiators(
  brandVision: string,
  logoPhilosophy: string,
  mascotPhilosophy: string
): string[] {
  const allText = [brandVision, logoPhilosophy, mascotPhilosophy].join("。");
  const phrases = allText.split(/[。，,]/).filter((p) => p.trim().length >= 6);
  return [...new Set(phrases)].slice(0, 5);
}

function inferTargetAudience(targetMarket: string): string {
  if (!targetMarket) return "未指定";
  return targetMarket;
}

function mapIndustryCategory(industry: string): IndustryCategory {
  return INDUSTRY_CATEGORY_MAP[industry] || "other";
}

/**
 * Main analysis function.
 * Takes a submission / clientInfo object and produces a BrandProfile.
 */
export function analyzeBrand(clientInfo: {
  companyName?: string;
  industry?: string;
  brandVision?: string;
  coreValues?: string;
  targetMarket?: string;
  logoPhilosophy?: string;
  mascotPhilosophy?: string;
  logoAssets?: { url: string }[];
  mascotAssets?: { files: { url: string }[] }[];
}): BrandProfile {
  const companyName = clientInfo?.companyName || "";
  const industry = clientInfo?.industry || "";
  const brandVision = clientInfo?.brandVision || "";
  const coreValues = clientInfo?.coreValues || "";
  const targetMarket = clientInfo?.targetMarket || "";
  const logoPhilosophy = clientInfo?.logoPhilosophy || "";
  const mascotPhilosophy = clientInfo?.mascotPhilosophy || "";

  const logoCount = clientInfo?.logoAssets?.length || 0;
  const mascotCount = clientInfo?.mascotAssets?.length || 0;

  const dictResult = scanMultipleFields({
    brandVision,
    coreValues,
    targetMarket,
    logoPhilosophy,
    mascotPhilosophy,
    companyName,
  });

  const { brandType, confidence } = inferBrandType(
    companyName, industry, brandVision, logoPhilosophy,
    {
      matchedKeywords: dictResult.allKeywords,
      matchedCategories: dictResult.allCategories,
      matchedIndustryHints: dictResult.allIndustryHints,
      totalWeight: dictResult.totalWeight,
    }
  );

  const brandPersona = inferBrandPersona(brandVision, coreValues, mascotPhilosophy, dictResult.allCategories);

  return {
    brandType,
    confidence,
    brandPersona,
    industry,
    industryCategory: mapIndustryCategory(industry),
    hasLogo: logoCount > 0,
    hasMascot: mascotCount > 0,
    logoCount,
    mascotCount,
    brandStage: inferBrandStage(clientInfo),
    targetAudience: inferTargetAudience(targetMarket),
    differentiators: extractDifferentiators(brandVision, logoPhilosophy, mascotPhilosophy),
    visualDirection: inferVisualDirection(brandType, brandPersona),
    // V2 新字段
    brandPositioning: inferBrandPositioning(companyName, brandVision, industry, brandType),
    brandVoice: inferBrandVoice(brandPersona),
    brandArchetype: inferBrandArchetype(brandPersona),
    analysis: {
      brandVisionKeywords: dictResult.fieldResults.brandVision?.matchedKeywords || [],
      coreValueKeywords: dictResult.fieldResults.coreValues?.matchedKeywords || [],
      marketKeywords: dictResult.fieldResults.targetMarket?.matchedKeywords || [],
    },
  };
}
