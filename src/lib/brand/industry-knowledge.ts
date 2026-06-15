/**
 * Brand Brain V1 — Industry Knowledge Base
 *
 * V2: Added subCategory for finer-grained industry classification.
 *
 * A local, deterministic knowledge base that maps industries to their
 * design characteristics, typical VI modules, visual style references,
 * and page-count recommendations.
 *
 * No external API calls. Pure data.
 */

import type { BrandProfile, IndustryCategory } from "./brand-analyzer";

export interface IndustryProfile {
  /** Category identifier (一级) */
  category: IndustryCategory;

  /** Sub-category (二级) - more specific than category */
  subCategory?: string;

  /** Human-readable label */
  label: string;

  /** Design characteristics */
  designStyle: string[];
  colorTendency: string[];
  typographyStyle: string[];

  /** Typical modules for this industry */
  typicalModules: string[];

  /** Recommended page range (min, max) */
  recommendedPageRange: [number, number];

  /** Visual keywords for AI prompt generation */
  visualKeywords: string[];

  /** Sample brands in this category */
  sampleBrands: string[];
}

interface IndustryDataEntry extends Omit<IndustryProfile, "subCategory"> {
  /** Sub-categories (三级细分) with their specific overrides */
  subCategories?: Record<string, Partial<IndustryDataEntry>>;
}

const industryData: Record<string, IndustryDataEntry> = {
  // ========== 餐饮/食品 ==========
  food_beverage: {
    category: "food_beverage" as IndustryCategory,
    label: "餐饮/食品",
    designStyle: ["温暖自然", "食欲感强", "新鲜活力", "材质质感突出"],
    colorTendency: ["暖色系为主", "自然色系", "高饱和度点缀"],
    typographyStyle: ["圆润亲切", "手写风格可用", "中文书法/粗体"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "产品包装系统", "线下门店系统", "社媒内容系统", "宣传物料"],
    recommendedPageRange: [12, 18] as [number, number],
    visualKeywords: ["natural", "fresh", "organic", "appetizing", "warm"],
    sampleBrands: ["椰岛工坊", "喜茶", "三顿半", "元气森林"],
    subCategories: {
      // 饮品细分
      beverage: {
        designStyle: ["清凉感", "活力感", "透明感", "季节色彩"],
        colorTendency: ["清爽色系", "水果色", "透明渐变"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "产品包装系统", "线下门店系统", "社媒内容系统"],
        visualKeywords: ["refreshing", "vibrant", "clear", "seasonal"],
        sampleBrands: ["椰岛工坊", "喜茶", "元气森林", "农夫山泉"],
      },
      // 椰子水细分
      coconut_water: {
        designStyle: ["热带度假感", "天然纯净", "阳光活力"],
        colorTendency: ["绿色系", "蓝色系", "暖金色点缀"],
        typographyStyle: ["现代无衬线", "手写度假风", "圆润亲和"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "产品包装系统", "线下门店系统", "社媒内容系统"],
        visualKeywords: ["tropical", "natural", "pure", "summer", "beach"],
        sampleBrands: ["椰岛工坊", "Vita Coco", "Malee"],
      },
      // 餐厅/正餐
      restaurant: {
        designStyle: ["品质感", "格调", "材质突出", "氛围感"],
        colorTendency: ["暖色系", "深色基调", "金属色点缀"],
        typographyStyle: ["优雅衬线体", "书法风格", "精致排版"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "空间导视系统", "宣传物料", "数字媒体规范"],
        visualKeywords: ["elegant", "warm", "sophisticated", "ambiance"],
        sampleBrands: ["大董", "新荣记", "鼎泰丰"],
      },
      // 火锅/特色餐饮
      hotpot: {
        designStyle: ["热闹感", "烟火气", "社群感", "视觉冲击"],
        colorTendency: ["红色系", "暖色系", "高饱和度"],
        typographyStyle: ["粗体国潮", "手写招牌", "醒目大字"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "线下门店系统", "社媒内容系统"],
        visualKeywords: ["bold", "social", "hot", "spicy", "vibrant"],
        sampleBrands: ["海底捞", "小龙坎", "巴奴"],
      },
    },
  },

  // ========== 科技/互联网 ==========
  technology_it: {
    category: "technology_it" as IndustryCategory,
    label: "科技/互联网",
    designStyle: ["极简现代", "科技感强", "几何构成", "留白充分"],
    colorTendency: ["冷色系为主", "蓝色/紫色调", "渐变色流行"],
    typographyStyle: ["无衬线字体", "字重变化丰富", "字间距较大"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "数字产品界面规范", "宣传物料", "PPT模板"],
    recommendedPageRange: [10, 14] as [number, number],
    visualKeywords: ["minimal", "tech", "digital", "clean", "geometric"],
    sampleBrands: ["苹果", "字节跳动", "Notion", "Figma"],
    subCategories: {
      saas: {
        designStyle: ["简洁专业", "信任感", "数据可视化", "工具感"],
        colorTendency: ["蓝色系", "中性色", "克制用色"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "数字产品界面规范", "宣传物料"],
        visualKeywords: ["clean", "professional", "dashboard", "enterprise"],
        sampleBrands: ["飞书", "钉钉", "Slack"],
      },
      ai: {
        designStyle: ["未来感", "神秘感", "光效", "抽象图形"],
        colorTendency: ["紫色系", "深色背景", "发光色点缀"],
        typographyStyle: ["现代无衬线", "纤细字重", "字母标突出"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "数字产品界面规范"],
        visualKeywords: ["futuristic", "neon", "abstract", "glow"],
        sampleBrands: ["OpenAI", "Midjourney", "Anthropic"],
      },
    },
  },

  // ========== 零售/电商 ==========
  retail_ecommerce: {
    category: "retail_ecommerce" as IndustryCategory,
    label: "零售/电商",
    designStyle: ["视觉冲击力强", "促销感与品质感平衡", "产品图为核心"],
    colorTendency: ["品牌识别色鲜明", "高对比度", "限定色活跃"],
    typographyStyle: ["阅读性强", "标题用粗体", "数字展示突出"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "产品包装系统", "电商详情页模板", "社媒内容系统", "活动/促销视觉规范"],
    recommendedPageRange: [10, 16] as [number, number],
    visualKeywords: ["bold", "colorful", "product-focused", "clean"],
    sampleBrands: ["完美日记", "三只松鼠", "蕉下"],
  },

  // ========== 教育/培训 ==========
  education_training: {
    category: "education_training" as IndustryCategory,
    label: "教育/培训",
    designStyle: ["亲和力强", "清晰易读", "活力感", "信任感"],
    colorTendency: ["蓝色/绿色系", "温暖辅助色", "不过度鲜艳"],
    typographyStyle: ["清晰圆润", "字号层级丰富", "中文阅读友好"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "数字课件模板", "线下物料规范"],
    recommendedPageRange: [8, 14] as [number, number],
    visualKeywords: ["friendly", "clear", "trustworthy", "warm"],
    sampleBrands: ["得到", "VIPKID", "新东方"],
    subCategories: {
      online_learning: {
        designStyle: ["数字化", "简洁", "交互感", "模块化"],
        colorTendency: ["蓝色系为主", "明亮色点缀"],
        typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "数字产品界面规范", "宣传物料"],
        visualKeywords: ["digital", "clean", "interactive", "modular"],
        sampleBrands: ["Coursera", "得到", "Udemy"],
      },
    },
  },

  // ========== 医疗/健康 ==========
  healthcare_medical: {
    category: "healthcare_medical" as IndustryCategory,
    label: "医疗/健康",
    designStyle: ["专业信赖", "温和安抚", "洁净感", "人性化"],
    colorTendency: ["蓝色/绿色系", "低饱和度", "白色为主"],
    typographyStyle: ["清晰大方", "字距适中", "阅读舒适"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "空间导视系统", "数字媒体规范"],
    recommendedPageRange: [8, 12] as [number, number],
    visualKeywords: ["clean", "professional", "calm", "trustworthy"],
    sampleBrands: ["丁香园", "微医", "Keep"],
  },

  // ========== 金融/法律 ==========
  finance_legal: {
    category: "finance_legal" as IndustryCategory,
    label: "金融/法律",
    designStyle: ["稳重专业", "精致高端", "保守可靠", "细节精致"],
    colorTendency: ["深蓝/深红/金色", "低饱和度", "金属色点缀"],
    typographyStyle: ["经典衬线体", "严谨排版", "正式感强"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "办公应用系统", "宣传物料", "报告/PPT模板"],
    recommendedPageRange: [8, 12] as [number, number],
    visualKeywords: ["professional", "premium", "trustworthy", "classic"],
    sampleBrands: ["招商银行", "中金公司", "君合律所"],
  },

  // ========== 文化/传媒 ==========
  culture_media: {
    category: "culture_media" as IndustryCategory,
    label: "文化/传媒",
    designStyle: ["艺术感强", "创意自由", "视觉冲击", "个性鲜明"],
    colorTendency: ["用色大胆", "撞色常见", "渐变色丰富"],
    typographyStyle: ["实验性字体", "排版创意", "图文混排灵活"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "数字媒体规范", "社媒内容系统", "线下活动物料"],
    recommendedPageRange: [10, 16] as [number, number],
    visualKeywords: ["creative", "bold", "artistic", "dynamic"],
    sampleBrands: ["B站", "知乎", "单向空间"],
  },

  // ========== 制造业 ==========
  manufacturing: {
    category: "manufacturing" as IndustryCategory,
    label: "制造业",
    designStyle: ["简洁实用", "工业感", "可靠稳重", "功能性优先"],
    colorTendency: ["蓝色/灰色系", "低饱和度", "企业色稳重"],
    typographyStyle: ["简洁清晰", "功能优先", "图表标注规范"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "办公应用系统", "产品包装系统", "宣传物料", "展会/活动规范"],
    recommendedPageRange: [8, 14] as [number, number],
    visualKeywords: ["industrial", "reliable", "clean", "functional"],
    sampleBrands: ["华为", "三一重工", "海尔"],
  },

  // ========== 酒店/旅游 ==========
  hospitality_tourism: {
    category: "hospitality_tourism" as IndustryCategory,
    label: "酒店/旅游",
    designStyle: ["度假感", "高端舒适", "在地文化融合", "体验导向"],
    colorTendency: ["暖色/大地色系", "自然色彩", "金色/米色搭配"],
    typographyStyle: ["优雅衬线体", "手写风格可用", "多语言排版"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "IP规范", "空间导视系统", "宣传物料", "数字媒体规范"],
    recommendedPageRange: [12, 20] as [number, number],
    visualKeywords: ["luxury", "warm", "cultural", "serene"],
    sampleBrands: ["安缦", "松赞", "亚朵"],
  },

  // ========== 房地产 ==========
  real_estate: {
    category: "real_estate" as IndustryCategory,
    label: "房地产",
    designStyle: ["高端大气", "空间感强", "品质感突出", "生活场景化"],
    colorTendency: ["米色/金色/深灰", "暖色系", "低饱和度奢华感"],
    typographyStyle: ["精致衬线体", "中文粗体大气", "数字展示考究"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "宣传物料", "空间导视系统", "数字媒体规范"],
    recommendedPageRange: [8, 14] as [number, number],
    visualKeywords: ["premium", "spacious", "elegant", "lifestyle"],
    sampleBrands: ["万科", "融创", "绿城"],
  },

  // ========== 其他 ==========
  other: {
    category: "other" as IndustryCategory,
    label: "其他",
    designStyle: ["简洁专业", "可根据需求定制"],
    colorTendency: ["中性色为主", "品牌识别色"],
    typographyStyle: ["通用无衬线体", "清晰易读"],
    typicalModules: ["品牌故事", "Logo规范", "品牌色", "字体系统", "办公应用系统", "宣传物料"],
    recommendedPageRange: [8, 12] as [number, number],
    visualKeywords: ["clean", "professional", "versatile"],
    sampleBrands: [],
  },
};

/**
 * Get base industry profile for a given category
 */
export function getIndustryProfile(category: IndustryCategory): IndustryProfile {
  const base = industryData[category] || industryData.other;
  const { subCategories: _, ...profile } = base;
  return profile;
}

/**
 * Get industry profile with sub-category overrides.
 * If subCategory is provided and exists, its values override the base profile.
 */
export function getIndustryProfileWithSubCategory(
  category: IndustryCategory,
  subCategory?: string
): IndustryProfile {
  const base = industryData[category] || industryData.other;
  const { subCategories, ...baseProfile } = base;

  if (!subCategory || !subCategories || !subCategories[subCategory]) {
    return baseProfile;
  }

  const override = subCategories[subCategory];
  return {
    ...baseProfile,
    ...override,
    // Ensure category stays as the parent category
    category: baseProfile.category,
    // Merge arrays instead of replacing
    designStyle: override.designStyle || baseProfile.designStyle,
    colorTendency: override.colorTendency || baseProfile.colorTendency,
    typographyStyle: override.typographyStyle || baseProfile.typographyStyle,
    typicalModules: override.typicalModules || baseProfile.typicalModules,
    visualKeywords: override.visualKeywords || baseProfile.visualKeywords,
    sampleBrands: override.sampleBrands || baseProfile.sampleBrands,
    subCategory,
  };
}

/**
 * Get industry profile from a BrandProfile
 */
export function getProfileForBrand(profile: BrandProfile): IndustryProfile {
  return getIndustryProfile(profile.industryCategory);
}

/**
 * Get all industry profiles (for reference/dropdown)
 */
export function getAllIndustryProfiles(): IndustryProfile[] {
  return Object.values(industryData).map(({ subCategories: _, ...profile }) => profile);
}

/**
 * Get available sub-categories for a given category
 */
export function getSubCategories(category: IndustryCategory): string[] {
  const base = industryData[category];
  if (!base || !base.subCategories) return [];
  return Object.keys(base.subCategories);
}
