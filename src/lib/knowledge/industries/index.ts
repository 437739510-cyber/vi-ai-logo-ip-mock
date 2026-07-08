/**
 * Industry Knowledge Base — unified export
 * Each industry module exports typed configs for material specs, scenes,
 * color tendencies, and word packs.
 */
export { CATERING_INDUSTRY } from "./catering";
export { BEAUTY_INDUSTRY } from "./beauty";
export { RETAIL_INDUSTRY } from "./retail";
export { EDUCATION_INDUSTRY } from "./education";
export { FLOWER_INDUSTRY } from "./flower";

import { CATERING_INDUSTRY } from "./catering";
import { BEAUTY_INDUSTRY } from "./beauty";
import { RETAIL_INDUSTRY } from "./retail";
import { EDUCATION_INDUSTRY } from "./education";
import { FLOWER_INDUSTRY } from "./flower";

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
  "花店": FLOWER_INDUSTRY,
  "花艺": FLOWER_INDUSTRY,
  "鲜花": FLOWER_INDUSTRY,
  "绿植": FLOWER_INDUSTRY,
  "永生花": FLOWER_INDUSTRY,
  "婚礼花艺": FLOWER_INDUSTRY,
};


/** CATE-02: Fallback config for unrecognized industries — prevents crashes, logs warning */
export const FALLBACK_CONFIG = {
  industry: "通用",
  subIndustries: ["通用行业"],
  materialSpecs: {
    required: ["名片", "信纸", "手提袋", "宣传单页"],
    optional: ["包装盒", "海报", "纸杯", "员工服装"],
  },
  sceneSpecs: [
    { scene: "办公应用", materials: ["名片", "信纸", "信封"], notes: "通用办公VI物料" },
    { scene: "营销推广", materials: ["宣传单页", "海报", "手提袋"], notes: "通用营销物料" },
  ],
  colorTendency: {
    palette: "通用行业配色",
    primaryTones: ["品牌主色由AI根据品牌定位自动选取"],
    materialPreference: ["铜版纸157-300g", "白卡纸250-350g"],
  },
  wordPack: {
    forbidden: ["最", "第一", "唯一", "顶级", "国家级"],
    recommended: ["专业", "品质", "信赖", "创新"],
  },
};
/** Look up industry config by name (supports sub-industry fallback) */
export function getIndustryConfig(industryName: string): typeof CATERING_INDUSTRY | typeof FALLBACK_CONFIG {
  const config = INDUSTRY_CONFIGS[industryName];
  if (!config) {
    console.warn("[KB] Industry config not found for: " + industryName + " — using FALLBACK_CONFIG");
    return FALLBACK_CONFIG;
  }
  return config;
}
