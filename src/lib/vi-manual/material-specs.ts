/**
 * Material placement specs for VI application pages.
 * Values are template defaults; industry-specific adjustments are allowed.
 */

import { getIndustryType, type IndustryType } from "../brand/industry-types";

/**
 * 已规范化的行业值全集（IndustryType）。工单 007-R1：
 * getIndustryType 的正则只识别中文行业文本，英文规范化值（beverage/
 * restaurant/general 等）会被二次归一化为 general，导致英文 beverage
 * 在 getMaterialSpecs("packaging") 丢失合法 cup-sleeve。
 * 因此已规范化值必须直接保留；原始中文行业文本仍走 getIndustryType。
 */
const NORMALIZED_INDUSTRY_TYPES: ReadonlySet<string> = new Set<string>([
  "restaurant", "fastfood", "beverage", "beauty", "fashion", "mother_baby",
  "wedding", "fitness", "pharmacy", "pet", "retail", "education",
  "fresh_food", "floral", "home", "nail", "tea", "general",
]);

export function resolveIndustryType(industry?: string): IndustryType {
  if (industry) {
    const normalized = industry.trim().toLowerCase();
    if (NORMALIZED_INDUSTRY_TYPES.has(normalized)) return normalized as IndustryType;
  }
  return getIndustryType(industry);
}

export interface MaterialSpec {
  id: string;
  name: string;
  size: string;
  logoPosition: string;
  logoSize: string;
  safeZone: string;
  note?: string;
}

export const MATERIAL_SPECS: MaterialSpec[] = [
  {
    id: "signboard",
    name: "门头招牌",
    size: "3000 x 600mm",
    logoPosition: "左上角，距边缘 10%",
    logoSize: "高度 ≤ 招牌高 15%",
    safeZone: "四周 10%",
  },
  {
    id: "cup-sleeve",
    name: "杯身/杯套",
    size: "杯套展开 91 x 55mm",
    logoPosition: "正面视觉中心偏上",
    logoSize: "LOGO 高度 10-12mm",
    safeZone: "四周 3mm",
  },
  {
    id: "carry-bag",
    name: "打包袋",
    size: "350 x 400 x 120mm",
    logoPosition: "袋面上方 40% 区域",
    logoSize: "宽度 ≤ 袋面宽 60%",
    safeZone: "四周 15mm",
  },
  {
    id: "staff-badge",
    name: "员工工牌",
    size: "54 x 85mm",
    logoPosition: "顶部居中",
    logoSize: "宽度 ≤ 20mm",
    safeZone: "四周 2mm",
  },
  {
    id: "menu",
    name: "菜单/价目表",
    size: "A4 横版",
    logoPosition: "页眉左上角",
    logoSize: "宽度 ≤ 40mm",
    safeZone: "四周 5mm",
  },
  {
    id: "avatar",
    name: "社媒头像",
    size: "1024 x 1024px",
    logoPosition: "居中",
    logoSize: "圆形安全区 80%",
    safeZone: "四周 10%",
  },
  {
    id: "video-cover",
    name: "短视频封面",
    size: "1080 x 1920px",
    logoPosition: "右上角",
    logoSize: "宽度 ≤ 108px",
    safeZone: "四周 10%",
  },
  {
    id: "web-banner",
    name: "网页 Banner",
    size: "1920 x 1080px",
    logoPosition: "左侧 10% 区域",
    logoSize: "高度 ≤ 80px",
    safeZone: "四周 10%",
  },
  {
    id: "wayfinding-sign",
    name: "导视门牌",
    size: "300 x 150mm",
    logoPosition: "左上角",
    logoSize: "高度 ≤ 30mm",
    safeZone: "四周 8mm",
  },
];

export function formatMaterialSpec(spec: MaterialSpec): string {
  return `排版坐标卡：${spec.name} ${spec.size}，LOGO ${spec.logoPosition}，LOGO ${spec.logoSize}，安全区 ${spec.safeZone}。`;
}

export function getMaterialSpecs(pageType: string, industry?: string): MaterialSpec[] {
  const industryType = resolveIndustryType(industry);
  const beverageLike = industryType === "beverage";
  const byPage: Record<string, string[]> = {
    stationery: ["staff-badge", "menu", "signboard"],
    // 工单 007：只有饮品行业默认包含杯套；餐饮/通用等其他行业不再被注入茶饮专属物料。
    packaging: beverageLike ? ["cup-sleeve", "carry-bag"] : ["carry-bag", "menu"],
    marketing: ["signboard", "wayfinding-sign", "web-banner"],
    "digital-media": ["avatar", "video-cover", "web-banner"],
    wayfinding: ["signboard", "wayfinding-sign"],
  };
  const ids = byPage[pageType] || [];
  return MATERIAL_SPECS.filter((s) => ids.includes(s.id));
}
