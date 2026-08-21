/**
 * Brand Brain V120 — Industry Knowledge Base
 *
 * Maps bb-clean IndustryType to industry-specific VI design knowledge:
 * typicalModules → guides DeepSeek to pick appropriate scene_atlas keys
 * visualKeywords → English keywords injected into ComfyUI prompts
 * designStyle   → design direction context for DNA extraction
 *
 * Adapted from COZE Brand Brain industry-knowledge.ts,
 * extended to cover all 18 bb-clean IndustryType values.
 */

import type { IndustryType } from "./industry-types";

// ── Types ──────────────────────────────────────────────

export interface IndustryKnowledge {
  /** bb-clean industry type id */
  type: IndustryType;
  /** @deprecated alias for type — old COZE interface compat */
  category: string;
  /** Human-readable label */
  label: string;
  /** Design style (Chinese, for DeepSeek context) */
  designStyle: string[];
  /** Color tendency (Chinese, for reference) */
  colorTendency: string[];
  /** Typical VI application modules — DeepSeek uses these to pick scene_atlas items */
  typicalModules: string[];
  /** Typography style guidance */
  typographyStyle: string[];
  /** Recommended page range [min, max] */
  recommendedPageRange: [number, number];
  /** Sample brands for reference */
  sampleBrands: string[];
  /** Visual keywords (English, injected into ComfyUI prompts) */
  visualKeywords: string[];
}

// ── Knowledge Data ─────────────────────────────────────

const knowledgeMap: Record<IndustryType, IndustryKnowledge> = {

  // ========== 汽车服务 ==========
  car: {
    type: "car",
    category: "car",
    label: "汽车服务",
    designStyle: ["专业感", "可靠感", "清洁感", "技术感"],
    colorTendency: ["深色系", "金属色", "蓝色系"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "门店系统", "营销物料", "会员系统"],
    typographyStyle: ["现代无衬线", "简洁有力", "工程感排版"],
    recommendedPageRange: [12, 16] as [number, number],
    sampleBrands: ["途虎养车", "天猫养车", "洗车先生"],
    visualKeywords: ["professional", "clean", "reliable", "automotive", "service"],
  },

  // ========== 餐饮 ==========
  restaurant: {
    type: "restaurant",
    category: "restaurant",
    label: "正餐/餐厅",
    designStyle: ["品质感", "格调", "材质突出", "氛围感"],
    colorTendency: ["暖色系", "深色基调", "金属色点缀"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "空间导视系统", "宣传物料", "数字媒体规范"],
    typographyStyle: ["优雅衬线体", "书法风格", "精致排版"],
    recommendedPageRange: [12,18] as [number, number],
    sampleBrands: ["大董", "新荣记", "鼎泰丰"],
    visualKeywords: ["elegant", "warm", "sophisticated", "ambiance"],
  },
  fastfood: {
    type: "fastfood",
    category: "fastfood",
    label: "小吃快餐",
    designStyle: ["热闹感", "烟火气", "社群感", "视觉冲击"],
    colorTendency: ["红色系", "暖色系", "高饱和度"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "线下门店系统", "社媒内容系统"],
    typographyStyle: ["粗体国潮", "手写招牌", "醒目大字"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["海底捞", "小龙坎", "巴奴"],
    visualKeywords: ["bold", "social", "hot", "spicy", "vibrant"],
  },
  beverage: {
    type: "beverage",
    category: "beverage",
    label: "饮品/奶茶",
    designStyle: ["清凉感", "活力感", "透明感", "季节色彩"],
    colorTendency: ["清爽色系", "水果色", "透明渐变"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "产品包装系统", "线下门店系统", "社媒内容系统"],
    typographyStyle: ["现代无衬线", "圆润亲和", "清爽排版"],
    recommendedPageRange: [10,16] as [number, number],
    sampleBrands: ["喜茶", "霸王茶姬", "蜜雪冰城"],
    visualKeywords: ["refreshing", "vibrant", "clear", "seasonal"],
  },
  tea: {
    type: "tea",
    category: "tea",
    label: "茶业",
    designStyle: ["东方美学", "自然质朴", "禅意雅致", "文化沉淀"],
    colorTendency: ["绿色系", "大地色系", "金色点缀"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "线下门店系统", "宣传物料"],
    typographyStyle: ["书法风格", "精致衬线", "东方韵味"],
    recommendedPageRange: [8,14] as [number, number],
    sampleBrands: ["小罐茶", "八马", "竹叶青"],
    visualKeywords: ["zen", "natural", "elegant", "traditional", "organic"],
  },
  fresh_food: {
    type: "fresh_food",
    category: "fresh_food",
    label: "生鲜",
    designStyle: ["新鲜自然", "健康活力", "洁净感", "透明感"],
    colorTendency: ["绿色系", "自然色系", "白色为主"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "线下门店系统", "宣传物料"],
    typographyStyle: ["清晰无衬线", "自然风格", "阅读友好"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["盒马", "每日优鲜", "叮咚买菜"],
    visualKeywords: ["fresh", "natural", "organic", "clean", "healthy"],
  },

  // ========== 美容/时尚 ==========
  beauty: {
    type: "beauty",
    category: "beauty",
    label: "美容/美发/养生",
    designStyle: ["优雅精致", "柔和舒适", "女性化", "高级感"],
    colorTendency: ["粉色系", "玫瑰金", "柔和暖色"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "空间导视系统", "产品包装系统", "社媒内容系统", "宣传物料"],
    typographyStyle: ["优雅衬线", "精致细体", "女性化"],
    recommendedPageRange: [10,16] as [number, number],
    sampleBrands: ["资生堂", "兰蔻", "完美日记"],
    visualKeywords: ["elegant", "soft", "feminine", "luxury", "serene"],
  },
  nail: {
    type: "nail",
    category: "nail",
    label: "美甲/美睫",
    designStyle: ["精致时尚", "潮流感", "个性化", "色彩丰富"],
    colorTendency: ["粉色/紫色系", "金属色点缀", "高饱和度"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "社媒内容系统", "宣传物料", "线下门店系统"],
    typographyStyle: ["时尚无衬线", "装饰性字体", "潮流感"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["悦诗风吟", "O.P.I", "小奥汀"],
    visualKeywords: ["trendy", "colorful", "chic", "glamour", "sparkle"],
  },
  fashion: {
    type: "fashion",
    category: "fashion",
    label: "服装/时尚",
    designStyle: ["视觉冲击力", "个性鲜明", "质感突出", "潮流导向"],
    colorTendency: ["黑白灰基础", "品牌识别色鲜明", "季节色系"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "线下门店系统", "社媒内容系统", "宣传物料"],
    typographyStyle: ["现代无衬线", "粗体标题", "杂志风"],
    recommendedPageRange: [10,16] as [number, number],
    sampleBrands: ["优衣库", "ZARA", "蕉下"],
    visualKeywords: ["fashion", "bold", "editorial", "textured", "minimal"],
  },

  // ========== 零售/电商 ==========
  retail: {
    type: "retail",
    category: "retail",
    label: "零售",
    designStyle: ["视觉冲击力", "促销感与品质感平衡", "产品图为核心"],
    colorTendency: ["品牌识别色鲜明", "高对比度", "限定色活跃"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "电商详情页模板", "社媒内容系统", "活动/促销视觉规范"],
    typographyStyle: ["阅读性强", "标题用粗体", "数字展示突出"],
    recommendedPageRange: [10,16] as [number, number],
    sampleBrands: ["完美日记", "三只松鼠", "蕉下"],
    visualKeywords: ["bold", "colorful", "product-focused", "clean"],
  },

  // ========== 医疗/健康 ==========
  pharmacy: {
    type: "pharmacy",
    category: "pharmacy",
    label: "医药/诊所/中医",
    designStyle: ["专业信赖", "温和安抚", "洁净感", "人性化"],
    colorTendency: ["蓝色/绿色系", "低饱和度", "白色为主"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "空间导视系统", "数字媒体规范"],
    typographyStyle: ["清晰大方", "字距适中", "阅读舒适"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["丁香园", "微医", "Keep"],
    visualKeywords: ["clean", "professional", "calm", "trustworthy"],
  },
  fitness: {
    type: "fitness",
    category: "fitness",
    label: "健身",
    designStyle: ["力量感", "活力动感", "简洁现代", "激励感"],
    colorTendency: ["红色/橙色系", "深色背景", "高对比度"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "空间导视系统", "社媒内容系统", "宣传物料"],
    typographyStyle: ["粗体无衬线", "动感字体", "醒目大字"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["Keep", "超级猩猩", "乐刻"],
    visualKeywords: ["powerful", "dynamic", "bold", "athletic", "modern"],
  },

  // ========== 教育 ==========
  education: {
    type: "education",
    category: "education",
    label: "教育/培训",
    designStyle: ["亲和力强", "清晰易读", "活力感", "信任感"],
    colorTendency: ["蓝色/绿色系", "温暖辅助色", "不过度鲜艳"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "数字课件模板", "线下物料规范"],
    typographyStyle: ["清晰圆润", "字号层级丰富", "中文阅读友好"],
    recommendedPageRange: [8,14] as [number, number],
    sampleBrands: ["得到", "VIPKID", "新东方"],
    visualKeywords: ["friendly", "clear", "trustworthy", "warm"],
  },

  // ========== 婚庆 ==========
  wedding: {
    type: "wedding",
    category: "wedding",
    label: "婚庆",
    designStyle: ["浪漫优雅", "仪式感", "精致奢华", "情感表达"],
    colorTendency: ["粉色/香槟色", "金色点缀", "柔和暖色"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "线下活动物料", "社媒内容系统"],
    typographyStyle: ["优雅衬线", "手写风格", "浪漫排版"],
    recommendedPageRange: [10,16] as [number, number],
    sampleBrands: ["婚礼纪", "铂爵旅拍", "唯一视觉"],
    visualKeywords: ["romantic", "elegant", "luxury", "soft", "golden"],
  },

  // ========== 母婴/宠物 ==========
  mother_baby: {
    type: "mother_baby",
    category: "mother_baby",
    label: "母婴",
    designStyle: ["温暖亲和", "柔软安全", "可爱精致", "信任感"],
    colorTendency: ["粉色/米色系", "柔和暖色", "低饱和度"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "社媒内容系统", "线下门店系统"],
    typographyStyle: ["圆润亲和", "柔美字体", "阅读友好"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["孩子王", "Babycare", "全棉时代"],
    visualKeywords: ["soft", "warm", "gentle", "caring", "cute"],
  },
  pet: {
    type: "pet",
    category: "pet",
    label: "宠物",
    designStyle: ["活泼可爱", "温暖友好", "趣味性", "亲和力"],
    colorTendency: ["暖色系", "活泼配色", "品牌识别色"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "社媒内容系统", "线下门店系统"],
    typographyStyle: ["圆润活泼", "趣味字体", "亲和力强"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["疯狂小狗", "pidan", "小佩"],
    visualKeywords: ["playful", "friendly", "cute", "warm", "fun"],
  },

  // ========== 花卉/家居 ==========
  floral: {
    type: "floral",
    category: "floral",
    label: "花店",
    designStyle: ["自然浪漫", "清新优雅", "季节感", "艺术气息"],
    colorTendency: ["粉色/绿色系", "自然色彩", "柔和配色"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "社媒内容系统", "线下门店系统"],
    typographyStyle: ["优雅衬线", "手写风格", "浪漫排版"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: ["花点时间", "野兽派", "花加"],
    visualKeywords: ["floral", "romantic", "natural", "elegant", "soft"],
  },
  home: {
    type: "home",
    category: "home",
    label: "家居",
    designStyle: ["温暖舒适", "品质生活", "简约实用", "空间感"],
    colorTendency: ["大地色系", "米色/灰色", "木色调"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "空间导视系统", "产品包装系统", "宣传物料"],
    typographyStyle: ["简洁无衬线", "温暖亲和", "阅读舒适"],
    recommendedPageRange: [8,14] as [number, number],
    sampleBrands: ["宜家", "造作", "网易严选"],
    visualKeywords: ["cozy", "warm", "minimal", "natural", "textured"],
  },

  // ========== 通用 ==========
  general: {
    type: "general",
    category: "general",
    label: "通用",
    designStyle: ["简洁专业", "可根据需求定制"],
    colorTendency: ["中性色为主", "品牌识别色"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "办公应用系统", "宣传物料"],
    typographyStyle: ["通用无衬线", "清晰易读"],
    recommendedPageRange: [8,12] as [number, number],
    sampleBrands: [],
    visualKeywords: ["clean", "professional", "versatile"],
  },
};

// ── Lookup API ─────────────────────────────────────────

/**
 * Get industry knowledge for a given IndustryType.
 * Returns general fallback if type not found.
 */
export function getIndustryKnowledge(type: IndustryType): IndustryKnowledge {
  return knowledgeMap[type] || knowledgeMap.general;
}

/**
 * Get all industry knowledge entries (for reference).
 */
export function getAllIndustryKnowledge(): IndustryKnowledge[] {
  return Object.values(knowledgeMap);
}

// ── Compatibility exports (old COZE interface) ─────────
// These are kept for files that still use the old API:
// design-director.ts, brand/analyze/route.ts, memory/index.ts, etc.

/** @deprecated Use IndustryKnowledge instead */
export type IndustryProfile = IndustryKnowledge;

/** @deprecated Use getIndustryKnowledge instead */
export function getProfileForBrand(profile: { industryCategory?: string }): IndustryKnowledge {
  // Map old industryCategory to IndustryType if possible
  const type = (profile.industryCategory || "general") as IndustryType;
  return getIndustryKnowledge(type);
}

/** @deprecated Use getAllIndustryKnowledge instead */
export function getAllIndustryProfiles(): IndustryKnowledge[] {
  return getAllIndustryKnowledge();
}

/** @deprecated No subcategories in V120 — returns empty array */
export function getSubCategories(_category: string): string[] {
  return [];
}


