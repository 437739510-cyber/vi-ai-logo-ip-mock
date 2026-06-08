/**
 * Brand Brain V1 — Module to Page Converter
 *
 * Converts ModulePlan (from Module Planner) into a set of page IDs
 * that the existing page generation pipeline can consume.
 *
 * This is the bridge between the new Brand Brain system and the
 * existing generate-manual-pages-stream route.
 *
 * The old system used a fixed PAGE_DEFS array.
 * The new system uses dynamic modules determined by brand analysis.
 * This converter maps module IDs → page IDs for generation.
 */

import type { ModulePlan, RecommendedModule } from "./module-planner";

export interface PageGenerationPlan {
  /** Ordered list of page IDs to generate */
  pageIds: string[];

  /** Page labels for UI display */
  pageLabels: { id: string; label: string; description: string }[];

  /** Total pages to generate */
  totalPages: number;

  /** Original module plan reference */
  sourceModules: RecommendedModule[];
}

/**
 * Default page ID template for core modules.
 * Each module maps to one or more page IDs.
 */
const MODULE_TO_PAGE_MAP: Record<string, string[]> = {
  "cover": ["cover"],
  "brand-story": ["brand-story"],
  "logo-specs": ["logo-interpretation", "logo-usage", "logo-variants"],
  "brand-colors": ["brand-colors", "color-psychology"],
  "typography": ["typography"],
  "ip-specs": ["ip-standard", "ip-expression", "ip-usage"],
  "packaging": ["packaging-1", "packaging-2"],
  "retail-store": ["store-signage", "store-display"],
  "social-media": ["social-media-cover", "social-media-template"],
  "office-apps": ["business-card", "letterhead", "ppt-template"],
  "digital-products": ["app-interface", "web-interface"],
  "marketing-collateral": ["brochure", "poster"],
  "signage-wayfinding": ["signage-indoor", "signage-outdoor"],
  "event-exhibition": ["exhibition-booth", "event-materials"],
  "closing": ["closing"],
};

/**
 * Convert a ModulePlan to a PageGenerationPlan.
 * Only includes modules with priority "essential" or "recommended".
 */
export function modulePlanToPages(modulePlan: ModulePlan): PageGenerationPlan {
  const selectedModules = modulePlan.modules.filter(
    (m) => m.priority === "essential" || m.priority === "recommended"
  );

  const pageIds: string[] = [];
  const pageLabels: { id: string; label: string; description: string }[] = [];

  for (const mod of selectedModules) {
    const mappedPages = MODULE_TO_PAGE_MAP[mod.id] || [mod.id];

    for (const pageId of mappedPages) {
      pageIds.push(pageId);
      pageLabels.push({
        id: pageId,
        label: mod.label,
        description: `${mod.label}（${mod.priority === "essential" ? "核心" : "推荐"}）`,
      });
    }
  }

  return {
    pageIds,
    pageLabels,
    totalPages: pageIds.length,
    sourceModules: selectedModules,
  };
}

/**
 * Convert a page ID back to legacy PAGE_DEFS format
 * for compatibility with generate-manual-pages-stream.
 */
export function pageIdsToLegacyDefs(
  pageIds: string[],
  companyName: string
): { id: string; label: string; desc: string }[] {
  const labelMap: Record<string, string> = {
    "cover": "封面",
    "brand-story": "品牌故事",
    "logo-interpretation": "标识诠释",
    "logo-usage": "Logo使用规范",
    "logo-variants": "Logo变体",
    "brand-colors": "标准色彩规范",
    "color-psychology": "色彩心理学",
    "typography": "字体系统",
    "ip-standard": "IP标准姿态",
    "ip-expression": "IP表情规范",
    "ip-usage": "IP使用规范",
    "packaging-1": "产品包装(一)",
    "packaging-2": "产品包装(二)",
    "store-signage": "门店标识",
    "store-display": "门店陈列",
    "social-media-cover": "社媒封面",
    "social-media-template": "社媒内容模板",
    "business-card": "名片规范",
    "letterhead": "信封信纸",
    "ppt-template": "PPT模板",
    "app-interface": "App界面规范",
    "web-interface": "网页界面规范",
    "brochure": "宣传册",
    "poster": "海报规范",
    "signage-indoor": "室内导视",
    "signage-outdoor": "户外导视",
    "exhibition-booth": "展台设计",
    "event-materials": "活动物料",
    "closing": "感谢页",
  };

  return pageIds.map((id) => ({
    id,
    label: labelMap[id] || id,
    desc: `${companyName} VI手册 - ${labelMap[id] || id}`,
  }));
}
