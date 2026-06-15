/**
 * Brand Brain V1 — Brand & Industry Keyword Dictionary
 *
 * A curated dictionary of high-value brand and industry keywords
 * used by the Brand Analyzer instead of naive regex word-splitting.
 *
 * No external NLP libraries. Pure curated data.
 */

// ========== Brand Type Keywords ==========

export interface BrandKeywordEntry {
  keyword: string;
  categories: string[];        // Which brand personas this implies
  industryHints: string[];     // Which industries this suggests
  weight: number;              // Importance (1-10)
}

/**
 * High-value brand keyword dictionary.
 * Matched against: companyName, brandVision, coreValues, logoPhilosophy, mascotPhilosophy
 */
export const BRAND_KEYWORDS: BrandKeywordEntry[] = [
  // === Product / Category descriptors ===
  { keyword: "椰子", categories: ["自然", "热带", "健康"], industryHints: ["food_beverage"], weight: 9 },
  { keyword: "饮品", categories: [], industryHints: ["food_beverage"], weight: 7 },
  { keyword: "果汁", categories: ["自然", "健康"], industryHints: ["food_beverage"], weight: 7 },
  { keyword: "茶", categories: ["自然", "匠心"], industryHints: ["food_beverage"], weight: 6 },
  { keyword: "咖啡", categories: ["精致", "匠心"], industryHints: ["food_beverage"], weight: 6 },
  { keyword: "零食", categories: ["阳光", "潮流"], industryHints: ["food_beverage"], weight: 6 },
  { keyword: "食品", categories: [], industryHints: ["food_beverage"], weight: 5 },
  { keyword: "餐饮", categories: [], industryHints: ["food_beverage"], weight: 5 },

  // === Nature / Environment ===
  { keyword: "自然", categories: ["自然"], industryHints: [], weight: 9 },
  { keyword: "天然", categories: ["自然", "健康"], industryHints: [], weight: 8 },
  { keyword: "有机", categories: ["自然", "健康"], industryHints: [], weight: 8 },
  { keyword: "绿色", categories: ["自然"], industryHints: [], weight: 7 },
  { keyword: "生态", categories: ["自然"], industryHints: [], weight: 7 },
  { keyword: "热带", categories: ["阳光", "自然"], industryHints: [], weight: 8 },
  { keyword: "阳光", categories: ["阳光", "温暖"], industryHints: [], weight: 7 },
  { keyword: "海南", categories: ["热带", "自然"], industryHints: ["food_beverage", "hospitality_tourism"], weight: 6 },
  { keyword: "北纬", categories: ["匠心", "自然"], industryHints: ["food_beverage"], weight: 7 },
  { keyword: "海洋", categories: ["自然", "阳光"], industryHints: ["hospitality_tourism"], weight: 5 },
  { keyword: "纯净", categories: ["自然", "健康"], industryHints: [], weight: 8 },
  { keyword: "新鲜", categories: ["自然", "健康"], industryHints: ["food_beverage"], weight: 7 },

  // === Health / Wellness ===
  { keyword: "健康", categories: ["健康"], industryHints: ["healthcare_medical", "food_beverage"], weight: 9 },
  { keyword: "活力", categories: ["健康", "阳光"], industryHints: [], weight: 7 },
  { keyword: "营养", categories: ["健康"], industryHints: ["food_beverage", "healthcare_medical"], weight: 7 },
  { keyword: "健身", categories: ["健康", "阳光"], industryHints: ["healthcare_medical"], weight: 6 },
  { keyword: "运动", categories: ["健康", "阳光"], industryHints: [], weight: 6 },

  // === Quality / Craftsmanship ===
  { keyword: "匠心", categories: ["匠心", "专业"], industryHints: [], weight: 9 },
  { keyword: "品质", categories: ["匠心", "专业"], industryHints: [], weight: 8 },
  { keyword: "定制", categories: ["匠心", "专业"], industryHints: [], weight: 7 },
  { keyword: "专注", categories: ["匠心", "专业"], industryHints: [], weight: 7 },
  { keyword: "传承", categories: ["匠心"], industryHints: ["culture_media"], weight: 6 },
  { keyword: "工艺", categories: ["匠心"], industryHints: ["manufacturing"], weight: 6 },
  { keyword: "经典", categories: ["匠心", "精致"], industryHints: [], weight: 5 },

  // === Technology / Innovation ===
  { keyword: "科技", categories: ["创新", "专业"], industryHints: ["technology_it"], weight: 9 },
  { keyword: "创新", categories: ["创新"], industryHints: [], weight: 8 },
  { keyword: "智能", categories: ["创新"], industryHints: ["technology_it"], weight: 8 },
  { keyword: "数字", categories: ["创新"], industryHints: ["technology_it"], weight: 7 },
  { keyword: "数据", categories: ["创新", "专业"], industryHints: ["technology_it"], weight: 7 },
  { keyword: "AI", categories: ["创新"], industryHints: ["technology_it"], weight: 8 },
  { keyword: "人工智能", categories: ["创新"], industryHints: ["technology_it"], weight: 8 },
  { keyword: "未来", categories: ["创新"], industryHints: ["technology_it"], weight: 6 },
  { keyword: "前沿", categories: ["创新"], industryHints: ["technology_it"], weight: 7 },

  // === Premium / Luxury ===
  { keyword: "高端", categories: ["精致", "专业"], industryHints: [], weight: 7 },
  { keyword: "精致", categories: ["精致"], industryHints: [], weight: 8 },
  { keyword: "优雅", categories: ["精致"], industryHints: [], weight: 7 },
  { keyword: "奢华", categories: ["精致"], industryHints: ["hospitality_tourism", "real_estate"], weight: 7 },
  { keyword: "品位", categories: ["精致"], industryHints: [], weight: 6 },
  { keyword: "美学", categories: ["精致"], industryHints: ["culture_media"], weight: 6 },

  // === Warmth / Humanity ===
  { keyword: "温暖", categories: ["温暖"], industryHints: [], weight: 7 },
  { keyword: "亲切", categories: ["温暖"], industryHints: [], weight: 6 },
  { keyword: "友好", categories: ["温暖"], industryHints: [], weight: 5 },
  { keyword: "关怀", categories: ["温暖"], industryHints: ["healthcare_medical"], weight: 6 },
  { keyword: "陪伴", categories: ["温暖"], industryHints: [], weight: 5 },
  { keyword: "爱", categories: ["温暖"], industryHints: [], weight: 6 },

  // === Youth / Trend ===
  { keyword: "潮流", categories: ["潮流"], industryHints: ["retail_ecommerce"], weight: 7 },
  { keyword: "时尚", categories: ["潮流"], industryHints: ["retail_ecommerce", "culture_media"], weight: 7 },
  { keyword: "个性", categories: ["潮流"], industryHints: [], weight: 6 },
  { keyword: "年轻", categories: ["潮流"], industryHints: [], weight: 6 },
  { keyword: "新锐", categories: ["潮流", "创新"], industryHints: [], weight: 6 },

  // === Professional / Trust ===
  { keyword: "专业", categories: ["专业"], industryHints: [], weight: 9 },
  { keyword: "权威", categories: ["专业"], industryHints: ["finance_legal", "healthcare_medical"], weight: 7 },
  { keyword: "信赖", categories: ["专业", "温暖"], industryHints: [], weight: 8 },
  { keyword: "可靠", categories: ["专业"], industryHints: ["manufacturing"], weight: 7 },
  { keyword: "安全", categories: ["专业", "健康"], industryHints: ["healthcare_medical", "manufacturing"], weight: 7 },
  { keyword: "精准", categories: ["专业"], industryHints: [], weight: 6 },
  { keyword: "严谨", categories: ["专业"], industryHints: ["finance_legal"], weight: 6 },

  // === Specific brand elements ===
  { keyword: "IP", categories: ["潮流", "阳光"], industryHints: [], weight: 7 },
  { keyword: "公仔", categories: ["阳光", "温暖"], industryHints: [], weight: 6 },
  { keyword: "形象", categories: [], industryHints: [], weight: 4 },
  { keyword: "吉祥物", categories: ["阳光", "温暖"], industryHints: [], weight: 6 },
  { keyword: "3D", categories: ["创新", "潮流"], industryHints: [], weight: 5 },
  { keyword: "卡通", categories: ["阳光", "温暖"], industryHints: [], weight: 5 },

  // === Industry-specific terms ===
  { keyword: "教育", categories: ["专业", "温暖"], industryHints: ["education_training"], weight: 7 },
  { keyword: "培训", categories: ["专业"], industryHints: ["education_training"], weight: 6 },
  { keyword: "医疗", categories: ["专业", "健康"], industryHints: ["healthcare_medical"], weight: 8 },
  { keyword: "金融", categories: ["专业", "精致"], industryHints: ["finance_legal"], weight: 7 },
  { keyword: "法律", categories: ["专业"], industryHints: ["finance_legal"], weight: 7 },
  { keyword: "制造", categories: ["专业", "匠心"], industryHints: ["manufacturing"], weight: 6 },
  { keyword: "酒店", categories: ["精致", "温暖"], industryHints: ["hospitality_tourism"], weight: 6 },
  { keyword: "旅行", categories: ["阳光", "自然"], industryHints: ["hospitality_tourism"], weight: 6 },
  { keyword: "零售", categories: [], industryHints: ["retail_ecommerce"], weight: 5 },
  { keyword: "电商", categories: [], industryHints: ["retail_ecommerce"], weight: 5 },
  { keyword: "文化", categories: ["匠心", "精致"], industryHints: ["culture_media"], weight: 6 },
  { keyword: "传媒", categories: ["创新", "潮流"], industryHints: ["culture_media"], weight: 6 },
];

// ========== Lookup Functions ==========

export interface KeywordMatchResult {
  matchedKeywords: string[];
  matchedCategories: string[];
  matchedIndustryHints: string[];
  totalWeight: number;
}

/**
 * Scan text against the brand keyword dictionary.
 * Returns matched keywords, inferred categories, and industry hints.
 */
export function scanBrandKeywords(text: string): KeywordMatchResult {
  if (!text) {
    return { matchedKeywords: [], matchedCategories: [], matchedIndustryHints: [], totalWeight: 0 };
  }

  const matchedKeywords: string[] = [];
  const categoryScores: Record<string, number> = {};
  const industryScores: Record<string, number> = {};
  let totalWeight = 0;

  for (const entry of BRAND_KEYWORDS) {
    if (text.includes(entry.keyword)) {
      matchedKeywords.push(entry.keyword);
      totalWeight += entry.weight;

      for (const cat of entry.categories) {
        categoryScores[cat] = (categoryScores[cat] || 0) + entry.weight;
      }
      for (const hint of entry.industryHints) {
        industryScores[hint] = (industryScores[hint] || 0) + entry.weight;
      }
    }
  }

  // Sort categories by score descending
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)
    .map(([cat]) => cat);

  const sortedIndustries = Object.entries(industryScores)
    .sort(([, a], [, b]) => b - a)
    .map(([hint]) => hint);

  return {
    matchedKeywords: [...new Set(matchedKeywords)],
    matchedCategories: sortedCategories,
    matchedIndustryHints: sortedIndustries,
    totalWeight,
  };
}

/**
 * Scan multiple text fields and aggregate results.
 */
export function scanMultipleFields(fields: Record<string, string>): {
  allKeywords: string[];
  allCategories: string[];
  allIndustryHints: string[];
  totalWeight: number;
  fieldResults: Record<string, KeywordMatchResult>;
} {
  const fieldResults: Record<string, KeywordMatchResult> = {};
  const allKeywords = new Set<string>();
  const allCategories = new Set<string>();
  const allIndustryHints = new Set<string>();
  let totalWeight = 0;

  for (const [fieldName, text] of Object.entries(fields)) {
    const result = scanBrandKeywords(text);
    fieldResults[fieldName] = result;
    result.matchedKeywords.forEach((k) => allKeywords.add(k));
    result.matchedCategories.forEach((c) => allCategories.add(c));
    result.matchedIndustryHints.forEach((h) => allIndustryHints.add(h));
    totalWeight += result.totalWeight;
  }

  return {
    allKeywords: [...allKeywords],
    allCategories: [...allCategories],
    allIndustryHints: [...allIndustryHints],
    totalWeight,
    fieldResults,
  };
}
