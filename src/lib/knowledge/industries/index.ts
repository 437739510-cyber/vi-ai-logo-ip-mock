/**
 * Industry Knowledge Base — unified export
 * Each industry module exports typed configs for material specs, scenes,
 * color tendencies, and word packs.
 */
export { CATERING_INDUSTRY } from "./catering";
export { BEAUTY_INDUSTRY } from "./beauty";
export { RETAIL_INDUSTRY } from "./retail";
export { EDUCATION_INDUSTRY } from "./education";

import { CATERING_INDUSTRY } from "./catering";
import { BEAUTY_INDUSTRY } from "./beauty";
import { RETAIL_INDUSTRY } from "./retail";
import { EDUCATION_INDUSTRY } from "./education";

/** All industry configs keyed by industry name for runtime lookup */
export const INDUSTRY_CONFIGS: Record<string, any> = {
  "餐饮": CATERING_INDUSTRY,
  "饮品": CATERING_INDUSTRY,
  "烘焙面包": CATERING_INDUSTRY,
  "面馆快餐": CATERING_INDUSTRY,
  "火锅": CATERING_INDUSTRY,
  "烧烤": CATERING_INDUSTRY,
  "茶饮": CATERING_INDUSTRY,
  "咖啡": CATERING_INDUSTRY,
  "美业": BEAUTY_INDUSTRY,
  "美容": BEAUTY_INDUSTRY,
  "美甲": BEAUTY_INDUSTRY,
  "美发": BEAUTY_INDUSTRY,
  "皮肤管理": BEAUTY_INDUSTRY,
  "SPA": BEAUTY_INDUSTRY,
  "零售": RETAIL_INDUSTRY,
  "商超": RETAIL_INDUSTRY,
  "服饰": RETAIL_INDUSTRY,
  "家居": RETAIL_INDUSTRY,
  "水果生鲜": RETAIL_INDUSTRY,
  "教育": EDUCATION_INDUSTRY,
  "培训": EDUCATION_INDUSTRY,
  "K12": EDUCATION_INDUSTRY,
  "早教": EDUCATION_INDUSTRY,
  "艺术培训": EDUCATION_INDUSTRY,
};

/** Look up industry config by name (supports sub-industry fallback) */
export function getIndustryConfig(industryName: string): typeof CATERING_INDUSTRY | undefined {
  return INDUSTRY_CONFIGS[industryName];
}
